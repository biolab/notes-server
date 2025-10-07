import { Database } from "sqlite";

import { QuestionDef } from "@/types";
import { elide } from "@/utils/string";

import { serializedContent } from "./md-helpers";
import { parseCollection, RawCollectionDef } from "./collection";
import { parseBook, RawBookDef, RawChapterDef } from "./book";
import { gatherRedirections, updateRedirections } from "./redirections";
import { catchErrors, hasError, logError } from "./errors";

const checkMoved = (moved: [string, string][]) => {
  moved.forEach(([from]) => {
    const prefixes = moved.filter(([f,]) => f !== from && f.startsWith(from));
    if (prefixes.length > 0) {
      logError(from, `${from} is a sub-path of ${prefixes.map(([f,]) => f).join(", ")}.`);
    }
  });
}

const checkBooks = async (
  books: RawBookDef[],
  allBookSlugs: Set<string>,
  db: Database,
  pathPrefix: string,
  moved: [string, string][],
  relaxed: string[],
) => {
  // All books that include questions with answers must exist (with the same slug)
  // JOIN answers ON questions.id = answers.questionId filters out the questions
  // that do not have answers.
  const booksWithQuestions = (await db.all(
    `SELECT DISTINCT books.path
     FROM books
     JOIN books_chapters ON books.id = books_chapters.bookId
     JOIN chapters ON books_chapters.chapterId = chapters.id
     JOIN questions ON chapters.id = questions.chapterId
     JOIN answers ON questions.id = answers.questionId
     ${pathPrefix ? "WHERE books.path LIKE ?" : ""}
     `,
     pathPrefix ? [`${pathPrefix}/%`] : []
  )).map(({path, ...rest}) => {
    const applicable = moved?.filter(([from]) => path.startsWith(from));
    if (!applicable?.length) {
      return { path, ...rest };
    }
    const [from, to] = applicable[0];
    return {
      path: path.replace(from, to),
      ...rest
    }});
  booksWithQuestions
    .filter(({ path }) => !allBookSlugs.has(path))
    .forEach(({ path }) =>
      logError(path, "Books that contain questions must not be removed.")
    );

  for (const book of books) {
    if (book.frontmatter.groups && book.frontmatter.tokens) {
      logError(
        book.slug,
        "A book may define 'groups' or 'tokens', not both."
      );
    }

    // Check that book content can be serialized
    await catchErrors(book.slug, async () =>
      await serializedContent(
        book.mdxContent, book.frontmatter.language, book.slug,
        ["Question"])
    );

    // Check that chapters' content can be serialized
    for (const { mdxContent, chapterDir } of book.chapters) {
      await catchErrors(chapterDir, async () =>
        serializedContent(mdxContent, book.frontmatter.language, chapterDir)
      );
    }

    /* Question-related checks
       Note that any book-specific issues must be checked here, not in checkQuestions.
       e.g., if the same question comes from another chapter, it's OK.
       e.g. (2), if a chapter with a question is removed, it is not OK.
     */

    // Extract all questions in the book
    type QuestionAndChapter = { chapter: string; question: QuestionDef };
    const bookQuestions: QuestionAndChapter[] =
      book.chapters.flatMap(({ questions, chapterDir }) =>
        questions.map((question) => ({chapter: chapterDir, question}))
      );

    // Check that no questions within the same book have the same questionId
    const questionsByIds: Record<string, QuestionAndChapter[]> = {};
    for (const { chapter, question } of bookQuestions) {
      if (questionsByIds[question.questionId] === undefined) {
        questionsByIds[question.questionId] = [];
      }
      questionsByIds[question.questionId].push({ question, chapter });
    }
    for (const [questionId, questions] of Object.entries(questionsByIds)) {
      if (questions.length > 1) {
        logError(
          book.slug,
          `Duplicate question "${elide(questionId)} (...)" in\n` +
            questions
              .map(({ chapter }) => `- ${chapter}`)
              .join("\n")
        );
      }
    }

    // No question with answers may disappear from the book
    if (!relaxed.includes(book.slug)) {
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
        )) as { questionId: string, hasAnswer: boolean }[]
      );
      const missingQuestions = pastQuestions.filter(
        ({questionId, hasAnswer}) => hasAnswer && !questionsByIds[questionId]
      );
      if (missingQuestions.length > 0) {
        missingQuestions.forEach(({questionId}) => {
          logError(
            book.slug,
            `Question "${elide(questionId)}" is missing.`
          );
        });
        const knownIds = pastQuestions.map(({questionId}) => questionId);
        const extras = bookQuestions.filter(
          ({question: {questionId}}) => !knownIds.includes(questionId)
        );
        if (extras.length > 0) {
          console.log(`Hint: if the above question(s) is an edit of an existing,
          set its 'id' to its original text.`
          );
          extras.forEach(({chapter, question: {questionId}}) => {
            console.log(`- ${chapter} "${elide(questionId)}"`);
          });
          console.log();
        }
      }
    }
  }
};

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
  const { chapterDir, mdxContent, questions,
          frontmatter: {title, omitAsChapter} } = chapter;
  if (await db.get(
      `SELECT 1 FROM chapters WHERE path = ? AND lastBuildId = ?`,
      [chapterDir, buildId])) {
    return;
  }
  const content = await serializedContent(mdxContent, language, chapterDir);
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
      [buildId, chapterDir, title, omitAsChapter, content]
    )
  ).id;

  let position = 0;
  for (const {questionId, question, type, options, answer} of questions) {
    await db.run(
      `
          INSERT INTO questions (chapterId, position, questionId, question, options, answer, type, lastBuildId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO UPDATE SET position    = excluded.position,
                                    question    = excluded.question,
                                    options     = excluded.options,
                                    answer      = excluded.answer,
                                    type        = excluded.type,
                                    lastBuildId = excluded.lastBuildId`,
      [chapterId, position++, questionId, question, JSON.stringify(options),
       answer, type, buildId]
    );
  }
};

const insertChapters = async (
  books: RawBookDef[],
  db: Database,
  buildId: number
) => {
  for (const { chapters, frontmatter: {language}} of books) {
    for (const chapter of chapters) {
      await insertChapter(chapter, language, db, buildId);
    }
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
      coverImg, requireLogin, quizThreshold, groups, tokens
    }
  } = book;
  const content = await serializedContent(mdxContent, language, slug);
  // Do not change this to "DELETE + INSERT" because it will delete rows that use this book's id as foreign key.
  const {id: bookId} = await db.get(
    `
        INSERT INTO books (lastBuildId,
                           path, title, subtitle,
                           public, language, tocInHeader,
                           coverImg, requireLogin, quizThreshold,
                           content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId          = excluded.lastBuildId,
                                  title                = excluded.title,
                                  subtitle             = excluded.subtitle,
                                  public               = excluded.public,
                                  language             = excluded.language,
                                  tocInHeader          = excluded.tocInHeader,
                                  coverImg             = excluded.coverImg,
                                  requireLogin         = excluded.requireLogin,
                                  quizThreshold        = excluded.quizThreshold,
                                  content              = excluded.content
        RETURNING id
    `,
    [
      buildId,
      slug, title, subTitle,
      isPublic, language, tocInHeader,
      coverImg, requireLogin, quizThreshold,
      content
    ]
  );

  await db.run(`DELETE FROM books_groups WHERE bookId = ?`, [bookId]);
  const groups_tokens =
    groups ? (Array.isArray(groups) ? groups : Object.entries(groups))
    : tokens ? tokens.map((t: string) => [null, t])
    : [];
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
      INSERT INTO books_groups (bookId, groupId, tokenId)
      VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [bookId, group && allGroups[group], token && allTokens[token]]);
  }

  await db.run(`DELETE FROM books_chapters WHERE bookId = ?`, [bookId]);
  await Promise.all(
    chapters.map(({ chapterDir }, position) =>
      db.run(
        `
            INSERT INTO books_chapters (bookId, chapterId, position, lastBuildId)
            SELECT ?, id, ?, ?
            FROM chapters
            WHERE path = ?
            ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId,
                                      position = excluded.position
        `,
        [bookId, position, buildId, chapterDir]
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

const insertFavicons = async (
  paths: string[],
  db: Database,
  buildId: number
) => {
  await Promise.all(
    paths.map((path) => {
      db.run(`
        INSERT INTO faviconpaths (path, lastBuildId)
        VALUES (?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
      `,
      [path, buildId]);
    }));
}

const movePaths = async (
  moved: [string, string][],
  db: Database
) => {
  for(const [from, to] of Object.entries(moved)) {
    for(const table of ["books", "collections", "chapters", "faviconpaths"]) {
      await db.run(
        `UPDATE ${table}
         SET path = ? || substr(path, ?)
         WHERE path LIKE ?`,
        [to, from.length + 1, from + "/%"]);
    }
  }
}

const cleanup = async (
  db: Database,
  pathPrefix: string,
  buildId: number
) => {
  await Promise.all(
    ["chapters", "books", "collections", "faviconpaths"].map((table) =>
      db.run(
        `DELETE FROM ${table}
         WHERE (path = ? OR path LIKE ?) AND lastBuildId <> ?`,
        [pathPrefix, pathPrefix + "/%", buildId]
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

export const updatePaths = async (
  bookSlugs: string[][],
  collectionSlugs: string[][],
  faviconPaths: string[],
  db: Database,
  buildId: number | null,
  pathPrefix: string,
  moved: [string, string][],
  relaxed: string[],
) => {
  const books = (await Promise.all(
    bookSlugs.map((book) => catchErrors(
      book.join("/"),
      async () => await parseBook(book))))
  ).filter(x => x) as RawBookDef[];
  const allBookSlugs = new Set(books.map(({ slug }) => slug));
  const collections = (await Promise.all(
    collectionSlugs.map((collection) => catchErrors(
      collection.join("/"),
      async () => await parseCollection(collection))))
  ).filter(x => x) as RawCollectionDef[];
  const allCollectionSlugs = new Set(collections.map(({ slug }) => slug));

  await checkMoved(moved);
  await checkBooks(books, allBookSlugs, db, pathPrefix, moved, relaxed);
  await checkCollections(collections, allCollectionSlugs, allBookSlugs);
  const redirections = gatherRedirections(pathPrefix);
  if (hasError()) {
    process.exit(1);
  }
  if (buildId === null) {
    return;
  }

  await movePaths(moved, db);
  await insertChapters(books, db, buildId);
  await insertBooks(books, db, buildId);
  await insertCollections(collections, db, buildId);
  await insertFavicons(faviconPaths, db, buildId);
  await updateRedirections(db, buildId, pathPrefix, redirections);

  await cleanup(db, pathPrefix, buildId);
};
