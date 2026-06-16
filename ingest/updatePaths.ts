import { Database } from "sqlite";
import fs from "fs";

import { elide } from "@/utils/string";

import { serializedContent } from "./md-helpers";
import { parseCollection, RawCollectionDef } from "./collection";
import { parseBook, RawBookDef, RawChapterDef } from "./book";
import { gatherRedirections, updateRedirections } from "./redirections";
import { catchErrors, hasError, logError, logWarning, printWarnings, resetError } from "./errors";
import { MailPath } from "@/ingest/mail";
import { inheritableResourcesFromPath } from "@/ingest/inheritables";
import {joinedPath} from "@/ingest/paths";
import {load} from "js-yaml";
import { UnlockChaptersOnAnswersOptions, InheritableResources } from "@/types";

const extractBookQuestions = async (
  book: RawBookDef,
  db: Database
) => {
  type QuestionAndChapter = { chapter: string; questionId: string };
  const bookQuestions: QuestionAndChapter[] = [];
  for (const {chapterPath, mdxContent, questions} of book.chapters) {
    if (!mdxContent) {
      bookQuestions.push(...
        (
          (await db.all(`
              SELECT questionId
              FROM questions
              JOIN chapters ON questions.chapterId = chapters.id
              WHERE chapters.path = ?`,
              [chapterPath])
          ) as { questionId: string }[]
        ).map(({questionId}) => ({chapter: chapterPath, questionId}))
      );
    } else {
      bookQuestions.push(...
        questions.map((question) => ({
            chapter: chapterPath,
            questionId: question.questionId
          })
        )
      );
    }
  }
  const questionsByChapters: {[questionId: string]: string[]} = {};
  for (const { chapter, questionId } of bookQuestions) {
    if (questionsByChapters[questionId] === undefined) {
      questionsByChapters[questionId] = [];
    }
    questionsByChapters[questionId].push(`- ${chapter}`);
  }

  return {bookQuestions, questionsByChapters};
}

const checkQuestions = async (
  books: RawBookDef[],
  allBookSlugs: Set<string>,
  db: Database,
  pathPrefix: string
) => {
  // All books that include questions with answers must exist (with the same slug)
  // JOIN answers ON questions.id = answers.questionId filters out the questions
  // that do not have answers.
  (await db.all(
    `SELECT DISTINCT books.path
     FROM books
     JOIN books_chapters ON books.id = books_chapters.bookId
     JOIN chapters ON books_chapters.chapterId = chapters.id
     JOIN questions ON chapters.id = questions.chapterId
     JOIN answers ON questions.id = answers.questionId
     ${pathPrefix ? "WHERE books.path LIKE ?" : ""}
     `,
    pathPrefix ? [`${pathPrefix}/%`] : []
  )).filter(({path}) => !allBookSlugs.has(path))
    .forEach(({path}) =>
      logWarning(path, "A book that contains question(s) has been removed.")
    );

  for (const book of books) {
    const pastQuestions = (
      (await db.all(
        `
                SELECT DISTINCT questions.questionId, a.id IS NOT NULL AS hasAnswer
                FROM questions
                         JOIN chapters ON questions.chapterId = chapters.id
                         JOIN books_chapters ON chapters.id = books_chapters.chapterId
                         JOIN books ON books_chapters.bookId = books.id
                         LEFT JOIN answers a ON questions.id = a.questionId AND a.bookId = books.id
                WHERE books.path = ?`,
        [book.slug]
      )) as {questionId: string, hasAnswer: boolean}[]
    );
    const { bookQuestions, questionsByChapters } = await extractBookQuestions(book, db);
    const missingQuestions = pastQuestions.filter(
      ({questionId, hasAnswer}) => hasAnswer && !questionsByChapters[questionId]
    );
    if (missingQuestions.length > 0) {
      missingQuestions.forEach(({questionId}) => {
        logWarning(
          book.slug,
          `Question "${elide(questionId)}" is missing.`
        );
      });
      const knownIds = pastQuestions.map(({questionId}) => questionId);
      const extras = bookQuestions.filter(
        ({questionId}) => !knownIds.includes(questionId)
      );
      if (extras.length > 0) {
        logWarning("", `Hint: if the above question(s) is an edit of an existing,
            set its 'id' to its original text.`
        );
        extras.forEach(({chapter, questionId}) => {
          logWarning("", `- ${chapter} "${elide(questionId)}"`);
        });
        logWarning("", "");
      }
    }
  }
}


const checkBooks = async (
  books: RawBookDef[],
  db: Database,
) => {
  for (const book of books) {
    if (book.frontmatter.groups && book.frontmatter.tokens) {
      logError(
        book.slug,
        "A book may define 'groups' or 'tokens', not both."
      );
    }

    if (!book.frontmatter.language) {
      logError(
        book.slug,
        "Book language could not be determined. " +
        "Please specify the 'language' field in the book frontmatter, " +
        "or in the frontmatter of the parent collection."
      );
    }
    else {
      // Check that book content can be serialized
      await catchErrors(book.slug, async () =>
        await serializedContent(
          book.mdxContent, book.frontmatter.language, book.slug,
          ["Question"])
      );

      // Check that chapters' content can be serialized
      for (const {mdxContent, chapterPath} of book.chapters) {
        if (mdxContent !== null) {
          await catchErrors(chapterPath, async () =>
            serializedContent(mdxContent, book.frontmatter.language, chapterPath)
          );
        }
      }
    }

    // Check that no questions within the same book have the same questionId
    Object.entries((await extractBookQuestions(book, db)).questionsByChapters)
      .filter(([, chapters]) => chapters.length > 1)
      .forEach(([questionId, chapters]) => {
        logError(
          book.slug,
          `Duplicate question "${elide(questionId)} (...)" in\n${chapters.join("\n")}`
        );
      });
  }
};

const buildCollectionParentMap = (collections: {[slug: string]: RawCollectionDef}
): {[collection: string]: string} => {
  const parentOf: {[collection: string]: string} = {};
  // First, if a collection includes another collection,
  // the former is a parent of the latter.
  Object.values(collections).forEach(({slug, collections: subCollections}) => {
    subCollections.forEach(({slug: subSlug}) => {
      parentOf[subSlug] = slug;
    });
  });
  // For others, we find the closest parent by slug prefix.
  Object.values(collections).forEach(({slug}) => {
    if (parentOf[slug] !== undefined) {
      return;
    }
    const candidates = Object.keys(collections)
      .filter((otherSlug) => slug.startsWith(otherSlug + "/"))
      .sort((a, b) => b.length - a.length);
    if (candidates.length > 0) {
      parentOf[slug] = candidates[0];
    }
  });
  return parentOf;
}

const readDefaults = (resourcePaths: InheritableResources) =>
  resourcePaths
    .filter(({type}) => type === "defaults")
    .map(({path}): [string, any] => {
      const fpath = joinedPath([path, "defaults.yml"]);
      try {
        const defaults = fs.readFileSync(fpath, "utf-8");
        const data = load(defaults);
        return [path, data];
      }
      catch (e) {
        logError(path, `Failed to read defaults from ${fpath}: ${e instanceof Error ? e.message : e}`);
        return [path, {}];
      }
    })
    .sort((a, b) => a[0].split("/").length - b[0].split("/").length); // shallow paths first

const assignLanguages = (
  collections: RawCollectionDef[],
  books: RawBookDef[]
) => {
  const collectionsBySlug = Object.fromEntries(
    collections.map((collection) => [collection.slug, collection]));
  const parentMap = buildCollectionParentMap(collectionsBySlug);

  // A function that returns a language for a collection. If not assigned,
  // a collection gets the language from the most specific parent (whose
  // collection might need to be determined, recursively).
  // If there is no parent collection, it defaults to "en".
  const assignLanguage = (collection: RawCollectionDef): string =>
    collection.frontmatter.language ||=
      parentMap[collection.slug] === undefined ? "en"
      : assignLanguage(collectionsBySlug[parentMap[collection.slug]]);
  // Assign a language to each collection
  collections.forEach(assignLanguage);

  // Assign languages to books directly included in collections
  collections.forEach(({books, frontmatter: {language} }) => {
    books.forEach(({frontmatter}) => {
      frontmatter.language ||= language;
    });
  });

  // For other books, assign the language of the closest parent collection by slug.
  books.forEach(({frontmatter, slug}) => {
    frontmatter.language ||= collections
      .filter(({slug: collSlug}) => slug.startsWith(collSlug + "/"))
      .sort((a, b) => b.slug.length - a.slug.length)
      [0]?.frontmatter.language || "en";
  });
}

const checkCollections = async (
  collections: RawCollectionDef[],
  allCollectionSlugs: Set<string>,
  allBookSlugs: Set<string>
) => {
  for (const collection of collections) {
    // Check that collection content can be serialized
    await catchErrors(collection.slug, async () =>
      serializedContent(
        collection.mdxContent,
        collection.frontmatter.language,
        collection.slug,
        ["Question"])
    );

    // Check that all books in the collection exist
    const missingBooks = collection.books.filter(
      ({ slug }) => !allBookSlugs.has(slug)
    );
    if (missingBooks.length > 0) {
      logError(
        collection.slug,
        `The following books are missing in the collection:\n
        ${missingBooks
          .map((b) => `  ${b.slug}`)
          .join("\n")}`
      );
    }

    // Check that all collections in the collection exist
    const missingCollections = collection.collections.filter(
      ({ slug }) => !allCollectionSlugs.has(slug)
    );
    if (missingCollections.length > 0) {
      logError(
        collection.slug,
        `The following collections are missing in the collection:\n
         ${missingCollections
          .map((c) => `  ${c.slug}`)
          .join("\n")}`
      );
    }
  }
};

const insertChapter = async (
  chapter: RawChapterDef,
  language: string,
  db: Database,
  buildId: number // use -1 to force
) => {
  if (chapter.mdxContent === null) {
    const chapterId = (await db.get(
      `UPDATE chapters SET lastBuildId = ? WHERE path = ? RETURNING id`,
      [buildId, chapter.chapterPath]
    )).id;
    await db.get(
      `UPDATE questions SET lastBuildId = ? WHERE chapterId=?`,
      [buildId, chapterId]
    );
    return;
  }
  const { chapterPath, mdxContent, questions,
          frontmatter: {title, omitAsChapter} } = chapter;
  const content = await serializedContent(mdxContent, language, chapterPath);
  const chapterId = (
    await db.get(
      `
          INSERT INTO chapters (lastBuildId, path, title, omitAsChapter, content)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(path) DO UPDATE SET title         = excluded.title,
                                          lastBuildId   = excluded.lastBuildId,
                                          content       = excluded.content,
                                          omitAsChapter = excluded.omitAsChapter
          RETURNING id`,
      [buildId, chapterPath, title, omitAsChapter, content]
    )
  ).id;

  let position = 0;
  for (const {questionId, question, type, options, answer, maxPoints, maxAttempts} of questions) {
    await db.run(
      `
          INSERT INTO questions (chapterId, position, questionId, question, options, answer, maxPoints, maxAttempts, type, lastBuildId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO UPDATE SET position    = excluded.position,
                                    question    = excluded.question,
                                    options     = excluded.options,
                                    answer      = excluded.answer,
                                    maxPoints   = excluded.maxPoints,
                                    maxAttempts = excluded.maxAttempts,
                                    type        = excluded.type,
                                    lastBuildId = excluded.lastBuildId`,
      [chapterId, position++, questionId, question, JSON.stringify(options),
       answer, maxPoints, maxAttempts, type, buildId]
    );
  }
};

const insertChapters = async (
  books: RawBookDef[],
  db: Database,
  buildId: number
) => {
  // When determining unique chapters (to not waste time by inserting the same
  // chapter multiple times), we assume that the same chapter doesn't appear
  // in books with different languages.
  const uniqueChapters = Object.fromEntries(
    books.flatMap(({chapters, frontmatter: {language}}) =>
      chapters.map((chapter) =>
        [chapter.chapterPath, [chapter, language] as [RawChapterDef, string]]
      )
    )
  )
  for (const [chapter, language] of Object.values(uniqueChapters)) {
    await insertChapter(chapter, language, db, buildId);
  }
};

const insertBook = async (
  book: RawBookDef,
  allGroups: Record<string, number>,
  allTokens: Record<string, number>,
  db: Database,
  buildId: number
) => {
  const {
    mdxContent, chapters, slug,
    frontmatter: {
      title, subTitle, public: isPublic, language, tocInHeader,
      coverImg, requireLogin, quizThreshold, unlockChaptersOnAnswers, env, groups, tokens
    }
  } = book;
  const content = await serializedContent(mdxContent, language, slug);
  // Do not change this to "DELETE + INSERT" because it will delete rows that use this book's id as foreign key.
  const {id: bookId} = await db.get(
    `
        INSERT INTO books (lastBuildId,
                           path, title, subtitle,
                           public, language, tocInHeader,
                           coverImg, requireLogin, quizThreshold, unlockChaptersOnAnswers, env,
                           content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId          = excluded.lastBuildId,
                                  title                = excluded.title,
                                  subtitle             = excluded.subtitle,
                                  public               = excluded.public,
                                  language             = excluded.language,
                                  tocInHeader          = excluded.tocInHeader,
                                  coverImg             = excluded.coverImg,
                                  requireLogin         = excluded.requireLogin,
                                  quizThreshold        = excluded.quizThreshold,
                                  unlockChaptersOnAnswers = excluded.unlockChaptersOnAnswers,
                                  env                  = excluded.env,
                                  content              = excluded.content
        RETURNING id
    `,
    [
      buildId,
      slug, title, subTitle,
      isPublic, language, tocInHeader,
      coverImg, requireLogin, quizThreshold,
      UnlockChaptersOnAnswersOptions.indexOf(unlockChaptersOnAnswers),
      JSON.stringify(env ?? {}),
      content
    ]
  );

  await db.run(`DELETE FROM books_groups WHERE bookId = ?`, [bookId]);
  const groups_tokens =
    groups ? (Array.isArray(groups) ? groups : Object.entries(groups))
    : tokens ? tokens.map((t: string) => [null, t])
    : [];
  let position = 1;
  for(const group_token of groups_tokens) {
    const [group, token] = typeof(group_token) === "string" ? [group_token] : group_token;
    if (group && allGroups[group] === undefined) {
      allGroups[group] = (await db.get(`
        INSERT INTO groups (name) VALUES (?) RETURNING id`,
        [group])).id;
    }
    if (token && allTokens[token] === undefined) {
      allTokens[token] = (await db.get(`
        INSERT INTO tokens (token) VALUES (?) RETURNING id`,
        [token])).id;
    }
    await db.run(`
      INSERT INTO books_groups (bookId, groupId, tokenId, position)
      VALUES (?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [bookId, group && allGroups[group], token && allTokens[token], position++]);
  }

  await db.run(`DELETE FROM books_chapters WHERE bookId = ?`, [bookId]);
  await Promise.all(
    chapters.map(({ chapterPath }, position) =>
      db.run(
        `
            INSERT INTO books_chapters (bookId, chapterId, position, lastBuildId)
            SELECT ?, id, ?, ?
            FROM chapters
            WHERE path = ?
            ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId,
                                      position = excluded.position
        `,
        [bookId, position, buildId, chapterPath]
      )
    )
  );

  await db.run(`DELETE FROM book_admins WHERE bookId = ?`, [bookId]);
  for (const adminEmail of book.frontmatter.admins || []) {
    await db.run(
      `
          INSERT INTO book_admins (bookId, email)
          VALUES (?, ?)
          ON CONFLICT DO NOTHING
      `,
      [bookId, adminEmail]
    );
  }
};

const insertBooks = async (
  books: RawBookDef[],
  db: Database,
  buildId: number
) => {
  const allGroups = Object.fromEntries(
    ((await db.all(`SELECT * FROM groups`)) as {name: string, id: number}[])
      .map(({name, id}) => [name, id]));
  const allTokens = Object.fromEntries(
    ((await db.all(`SELECT * FROM tokens`)) as {token: string, id: number}[])
      .map(({token, id}) => [token, id]));

  for (const book of books) {
    await insertBook(book, allGroups, allTokens, db, buildId);
  }
};

const insertCollections = async (
  collections: RawCollectionDef[],
  db: Database,
  buildId: number
) => {
  for (const {
    slug: collectionSlug,
    frontmatter: { title, subTitle, public: isPublic, language, coverImg, recursiveContent },
    mdxContent
  } of collections) {
    const content = await serializedContent(mdxContent, language, collectionSlug);
    // Do not change this to "DELETE + INSERT" because it will delete rows that use this collection's id as foreign key.
    await db.get(
      `
          INSERT INTO collections (lastBuildId,
                                   path, title, subtitle,
                                   public, language, coverImg, recursiveContent,
                                   content)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(path) DO UPDATE SET title            = excluded.title,
                                          lastBuildId      = excluded.lastBuildId,
                                          subtitle         = excluded.subtitle,
                                          public           = excluded.public,
                                          language         = excluded.language,
                                          coverImg         = excluded.coverImg,
                                          recursiveContent = excluded.recursiveContent,
                                          content          = excluded.content
          RETURNING id
      `,
      [buildId, collectionSlug, title, subTitle, isPublic, language,
       coverImg, recursiveContent, content]
    );
  }

  for (const { slug: collectionSlug, frontmatter, collections: subCollections, books } of collections) {
    const collectionId = (await db.get(`SELECT id FROM collections WHERE path = ?`, [collectionSlug])).id;
    const explicitBooks = !!frontmatter.books;
    const explicitCollections = !!frontmatter.collections;
    await db.run(
      `DELETE FROM collections_books WHERE collectionId = ?`,
      [collectionId]);
    await Promise.all(
      books.map(({ slug }, position) =>
        db.run(
      `
          INSERT INTO collections_books (
              collectionId, bookId, position, explicit, lastBuildId)
          SELECT ?, id, ?, ?, ?
          FROM books
          WHERE path = ?
          ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId,
                                    position = excluded.position,
                                    explicit = excluded.explicit
      `,
      [collectionId, position, explicitBooks, buildId, slug]))
    );
    await db.run(
      `DELETE FROM collections_collections WHERE collectionId = ?`,
      [collectionId]);
    await Promise.all(
      subCollections.map(({ slug }, position) => {
        db.run(
      `
          INSERT INTO collections_collections (
              collectionId, subCollectionId, position, explicit, lastBuildId)
          SELECT ?, id, ?, ?, ?
          FROM collections
          WHERE path = ?
          ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId,
                                    position = excluded.position,
                                    explicit = excluded.explicit
      `,
      [collectionId, position, explicitCollections, buildId, slug])})
    );

    await db.run(`DELETE FROM collection_admins WHERE collectionId = ?`, [collectionId]);
    for (const adminEmail of frontmatter.admins || []) {
      await db.run(
        `
          INSERT INTO collection_admins (collectionId, email)
          VALUES (?, ?)
          ON CONFLICT DO NOTHING
      `,
        [collectionId, adminEmail]
      );
    }

  }
};

const insertResourcePaths = async (
  paths: InheritableResources,
  db: Database,
  buildId: number
) => {
  await Promise.all(
    paths
    .filter(({db}) => db)
    .map(({path, type}) => {
      db.run(`
        INSERT INTO inheritables (path, type, lastBuildId)
        VALUES (?, ?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
      `,
      [path, type, buildId]);
    }));
}

const insertLoginMails = async (
  mailPaths: MailPath[],
  prefix: string,
  db: Database,
  buildId: number
) => {
  await Promise.all(
    mailPaths.map(({path, subject, plain, html}) => {
      db.run(`
        INSERT INTO loginmails (path, subject, plain, html, lastBuildId)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET subject = excluded.subject,
                                  plain = excluded.plain,
                                  html = excluded.html,
                                  lastBuildId = excluded.lastBuildId
      `,
      [path, subject, plain, html, buildId]);
    }));
}

const cleanup = async (
  db: Database,
  pathPrefix: string,
  buildId: number
) => {
  await Promise.all(
    ["chapters", "books", "collections", "inheritables", "loginmails"].map((table) =>
      db.run(
        `DELETE FROM ${table}
         WHERE (path = ? OR path LIKE ?) AND lastBuildId <> ?`,
        [pathPrefix, pathPrefix ? pathPrefix + "/%" : "", buildId]
      )
    )
  );
  await db.run(
    `
     DELETE FROM questions
     WHERE chapterId IN (
         SELECT id FROM chapters WHERE lastBuildId = ?
     ) AND lastBuildId <> ?;`,
    [buildId, buildId]
  );
}

const getNewBuildId = async (db: Database, pathPrefix: string): Promise<number> =>
  (await db.get(
    `INSERT INTO builds (path) VALUES (?) RETURNING id`,
    [pathPrefix || ""]
  )).id;

export const updatePaths = async (
  bookSlugs: string[][],
  collectionSlugs: string[][],
  resourcePaths: InheritableResources,
  mailPaths: MailPath[],
  db: Database,
  buildId_: number | null | "new",
  prevBuild: Date,
  pathPrefix: string,
): Promise<boolean | number> => {
  resetError();

  const collectedDefaults = readDefaults(resourcePaths);
  const books = (await Promise.all(
    bookSlugs.map((book) => catchErrors(
      book.join("/"),
      async () => await parseBook(book, prevBuild, collectedDefaults))))
  ).filter(x => x) as RawBookDef[];
  const allBookSlugs = new Set(books.map(({ slug }) => slug));
  const collections = (await Promise.all(
    collectionSlugs.map((collection) => catchErrors(
      collection.join("/"),
      async () => await parseCollection(collection, collectedDefaults))))
  ).filter(x => x) as RawCollectionDef[];
  const allCollectionSlugs = new Set(collections.map(({ slug }) => slug));

  assignLanguages(collections, books);
  await checkBooks(books, db);
  await checkQuestions(books, allBookSlugs, db, pathPrefix);
  await checkCollections(collections, allCollectionSlugs, allBookSlugs);
  const redirections = gatherRedirections(pathPrefix);

  printWarnings();
  if (hasError()) {
    return false;
  }
  if (buildId_ === null) {
    return true;
  }

  await db.exec("BEGIN TRANSACTION");
  let buildId: number;
  if (buildId_ === "new") {
    buildId = await getNewBuildId(db, pathPrefix);
  }
  else {
    await db.run(
      `UPDATE builds
       SET timestamp = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [buildId_]
    );
    buildId = buildId_;
  }
  await insertChapters(books, db, buildId);
  await insertBooks(books, db, buildId);
  await insertCollections(collections, db, buildId);
  await insertResourcePaths(resourcePaths, db, buildId);
  await insertLoginMails(mailPaths, pathPrefix, db, buildId);

  await cleanup(db, pathPrefix, buildId);
  await db.exec("COMMIT");

  // This will tell the server to update redirections, which requires it
  // to access the database, hence it must come after the transaction to
  // make sure the changes are committed and to avoid locking issues.
  await updateRedirections(db, buildId, pathPrefix, redirections);
  return buildId;
};

export const updateRoot = async (db: Database) => {
  const buildId = await getNewBuildId(db, "");

  const rootCollection = await parseCollection([], []);
  if (rootCollection.frontmatter.public) {
    await insertCollections([rootCollection], db, buildId);
  }

  const resources = inheritableResourcesFromPath("");
  await insertResourcePaths(resources, db, buildId);

  await cleanup(db, "", buildId);
}
