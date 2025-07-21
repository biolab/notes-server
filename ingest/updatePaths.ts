import { serializedContent } from "./md-helpers";
import { Database } from "sqlite";
import { parseCollection, RawCollectionDef } from "@/ingest/collection";
import { parseBook, RawBookDef } from "@/ingest/book";
import { ChapterFrontmatter, QuestionDef } from "@/types/types";
import { catchErrors, hasError, logError } from "@/ingest/errors";

const checkBooks = async (
  books: RawBookDef[],
  allBookSlugs: Set<string>,
  db: Database,
  updatePath: string
): Promise<
  Record<string, { frontmatter: ChapterFrontmatter; questions: QuestionDef[] }>
> => {
  const chapters: Record<
    string,
    { frontmatter: ChapterFrontmatter; questions: QuestionDef[] }
  > = {};

  // All books that include questions (found in table questions) must exist (with the same slug)
  // TODO: We may allow removing books with questions that nobody has answered yet.
  const booksWithQuestions = await db.all(
    `SELECT DISTINCT books.path
     FROM books
     JOIN books_chapters ON books.id = books_chapters.bookId
     JOIN chapters ON books_chapters.chapterId = chapters.id
     JOIN questions ON chapters.id = questions.chapterId
     WHERE books.path LIKE ?`,
     [`${updatePath}/%`]
  );
  booksWithQuestions
    .filter(({ path }) => !allBookSlugs.has(path))
    .forEach(({ path }) =>
      logError(path, "Books that contain questions must not be removed.")
    );

  for (const book of books) {
    // Check that book content can be serialized
    await catchErrors(book.slug, async () =>
      await serializedContent(book.mdxContent, book.frontmatter.language)
    );

    // Check that chapters' content can be serialized
    for (const { mdxContent, chapterDir } of book.chapters) {
      await catchErrors(chapterDir, async () =>
        serializedContent(mdxContent, book.frontmatter.language)
      );
    }

    /* Question-related checks
       Note that any book-specific issues must be checked here, not in checkQuestions.
       e.g., if the same question comes from another chapter, it's OK.
       e.g. (2), if a chapter with a question is removed, it is not OK.
     */

    // Extract all questions in the book
    type QuestionAndChapter = { chapter: string; question: QuestionDef };
    const allQuestions: QuestionAndChapter[] = [];
    for (const { frontmatter, questions, chapterDir } of book.chapters) {
      allQuestions.push(
        ...questions.map((question) => ({chapter: chapterDir, question}))
      );
      chapters[chapterDir] = { frontmatter, questions };
    }

    // Check that no questions within the same book have the same questionId
    const questionsByIds: Record<string, QuestionAndChapter[]> = {};
    for (const { chapter, question } of allQuestions) {
      if (questionsByIds[question.questionId] === undefined) {
        questionsByIds[question.questionId] = [];
      }
      questionsByIds[question.questionId].push({ question, chapter });
    }
    for (const [questionId, questions] of Object.entries(questionsByIds)) {
      if (questions.length > 1) {
        logError(
          book.slug,
          `Duplicate question "${questionId.slice(0, 15)} (...)" in\n` +
            questions
              .map(({ chapter, question: { line } }) => `- ${chapter}:${line}`)
              .join("\n")
        );
      }
    }

    // No question may disappear from the book
    // TODO: We may allow removing questions that nobody has answered yet.
    const pastQuestions = (
      (await db.all(
        `
        SELECT questions.questionId
        FROM questions
                 JOIN chapters ON questions.chapterId = chapters.id
                 JOIN books_chapters ON chapters.id = books_chapters.chapterId
                 JOIN books ON books_chapters.bookId = books.id
        WHERE books.path = ?`,
        [book.slug]
      )) as { questionId: string }[]
    ).map(({ questionId }) => questionId);
    const missingQuestions = pastQuestions.filter(
      (questionId) => !questionsByIds[questionId]
    );
    if (missingQuestions.length > 0) {
      missingQuestions.forEach((questionId) => {
        logError(
          book.slug,
          `Question "${questionId.slice(0, 15)} (...)" is missing.`
        );
      });
      const extras = allQuestions.filter(
        ({ question: { questionId } }) => !pastQuestions.includes(questionId)
      );
      if (extras.length > 0) {
        console.log(
          "Hint: if any of the new questions is an edit of an existing, set its `id` to its original text."
        );
        extras.forEach(({ chapter, question: { questionId, line } }) => {
          console.log(
            `- ${chapter}:${line} "${questionId.slice(0, 15)} (...)"`
          );
        });
        console.log();
      }
    }
  }
  return chapters;
};

const checkQuestions = async (
  chapters: Record<
    string,
    { frontmatter: ChapterFrontmatter; questions: QuestionDef[] }
  >,
  db: Database
) => {
  const questions = Object.fromEntries(
    Object.entries(chapters).map(([chapterDir, { questions }]) => [
      chapterDir,
      Object.fromEntries(
        questions.map(({ questionId, answer }) => [questionId, answer])
      ),
    ])
  );

  // Answers may not change
  // TODO: We can allow that, but have to change existing answers
  // TODO: We may allow changing answers to questions that nobody has answered yet.
  const prevAnswers = await db.all(`
    SELECT chapterId, questionId, answer
    FROM questions`);
  prevAnswers.forEach(({ chapterId, questionId, question, answer }) => {
    const newAnswer = questions[chapterId]?.[questionId];
    if (newAnswer !== undefined && newAnswer !== answer) {
      logError(
        chapterId,
        `Question "${questionId}" (${question.slice(
          0,
          20
        )}) changed the answer from "${answer}" to "${newAnswer}". This is not allowed.`
      );
    }
  });
};

const checkCollections = async (
  collections: RawCollectionDef[],
  allCollectionSlugs: Set<string>,
  allBookSlugs: Set<string>
) => {
  for (const collection of collections) {
    // Check that collection content can be serialized
    await catchErrors(collection.slug, async () =>
      serializedContent(collection.mdxContent, collection.frontmatter.language)
    );

    // Check that all books in the collection exist
    const missingBooks = collection.books.filter(
      ({ slug }) => !allBookSlugs.has(slug)
    );
    if (missingBooks.length > 0) {
      logError(
        collection.slug,
        `The following books are missing in the collection:\n ${missingBooks
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
        `The following collections are missing in the collection:\n ${missingCollections
          .map((c) => `  ${c.slug}`)
          .join("\n")}`
      );
    }
  }
};

const insertChapters = async (
  books: RawBookDef[],
  db: Database,
  buildId: number
) => {
  for (const { chapters, frontmatter: {language}} of books) {
    for (const { chapterDir, frontmatter: {title, omitAsChapter}, mdxContent, questions } of chapters) {
      if (await db.get(`SELECT 1 FROM chapters WHERE path = ? AND lastBuildId = ?`,
                       [chapterDir, buildId])) {
        continue;
      }
      const content = await serializedContent(mdxContent, language);
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

      for (const {questionId, question, type, options, answer} of questions) {
        await db.run(
          `
              INSERT INTO questions (chapterId, questionId, question, options, answer, questionType, lastBuildId)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT DO UPDATE SET question    = excluded.question,
                                        lastBuildId = excluded.lastBuildId`,
          [
            chapterId,
            questionId,
            question,
            JSON.stringify(options),
            answer,
            type,
            buildId,
          ]
        );
      }
    }
  }
};

const insertBooks = async (
  books: RawBookDef[],
  db: Database,
  buildId: number
) => {
  for (const {
    mdxContent, chapters, slug,
    frontmatter: {
      title, subTitle, description, date, public: isPublic, language, tocInHeader,
      indexInitiallyClosed, coverImg, requireLogin, quizThreshold, loginSubtitle, email },
  } of books) {
    const content = await serializedContent(mdxContent, language);
    // Do not change this to "DELETE + INSERT" because it will delete rows that use this book's id as foreign key.
    const { id: bookId } = await db.get(
      `
        INSERT INTO books (
            lastBuildId,
            path, title, subtitle, description, date,
            public, language, tocInHeader, indexInitiallyClosed,
            coverImg, requireLogin, quizThreshold, loginSubtitle,
            email_subject, email_body,
            content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId,
                                  title       = excluded.title,
                                  subtitle    = excluded.subtitle,
                                  description = excluded.description,
                                  date        = excluded.date,
                                  public      = excluded.public,
                                  language    = excluded.language,
                                  tocInHeader = excluded.tocInHeader,
                                  indexInitiallyClosed = excluded.indexInitiallyClosed,
                                  coverImg    = excluded.coverImg,
                                  requireLogin = excluded.requireLogin,
                                  quizThreshold = excluded.quizThreshold,
                                  loginSubtitle = excluded.loginSubtitle,
                                  email_subject = excluded.email_subject,
                                  email_body = excluded.email_body,
                                  content     = excluded.content
        RETURNING id
    `,
      [
        buildId,
        slug, title, subTitle, description, date,
        isPublic, language, tocInHeader, indexInitiallyClosed,
        coverImg, requireLogin, quizThreshold, loginSubtitle,
        email?.subject, email?.body,
        content
      ]
    );

    for (const { chapterDir } of chapters) {
      await db.run(
        `
          INSERT INTO books_chapters (bookId, chapterId, lastBuildId)
          SELECT ?, id, ?
          FROM chapters
          WHERE path = ?
          ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
      `,
        [bookId, buildId, chapterDir]
      );
    }
  }
};

const insertCollections = async (
  collections: RawCollectionDef[],
  db: Database,
  buildId: number
) => {
  for (const {
    slug: collectionSlug,
    frontmatter: { title, subTitle, date, description, public: isPublic, language, coverImg, recursiveContent },
  } of collections) {
    // Do not change this to "DELETE + INSERT" because it will delete rows that use this collection's id as foreign key.
    await db.get(
      `
          INSERT INTO collections (lastBuildId,
                                   path, title, subtitle, description, date,
                                   public, language, coverImg, recursiveContent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(path) DO UPDATE SET title            = excluded.title,
                                          lastBuildId      = excluded.lastBuildId,
                                          subtitle         = excluded.subtitle,
                                          description      = excluded.description,
                                          date             = excluded.date,
                                          public           = excluded.public,
                                          language         = excluded.language,
                                          coverImg         = excluded.coverImg,
                                          recursiveContent = excluded.recursiveContent
          RETURNING id
      `,
      [buildId, collectionSlug, title, subTitle, description, date, isPublic, language, coverImg, recursiveContent]
    );
  }

  for (const { slug: collectionSlug, collections: subCollections, books } of collections) {
      const collectionId = (await db.get(`SELECT id FROM collections WHERE path = ?`, [collectionSlug])).id;
      for (const { slug } of books) {
      await db.run(
        `
            INSERT INTO collections_books (collectionId, bookId, lastBuildId)
            SELECT ?, id, ?
            FROM books
            WHERE path = ?
            ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
        `,
        [collectionId, buildId, slug]
      );
    }

    for (const { slug } of subCollections) {
      await db.run(
        `
            INSERT INTO collections_collections (collectionId, subCollectionId, lastBuildId)
            SELECT ?, id, ?
            FROM collections
            WHERE path = ?
            ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
        `,
        [collectionId, buildId, slug]
      );
    }
  }
};

export const updatePaths = async (
  bookSlugs: string[][],
  collectionSlugs: string[][],
  db: Database,
  buildId: number,
  pathPrefix: string
) => {
  const books = await Promise.all(bookSlugs.map(parseBook));
  const allBookSlugs = new Set(books.map(({ slug }) => slug));
  const collections = await Promise.all(collectionSlugs.map(parseCollection));
  const allCollectionSlugs = new Set(collections.map(({ slug }) => slug));

  const chapters = await checkBooks(books, allBookSlugs, db, pathPrefix);
  await checkQuestions(chapters, db);
  await checkCollections(collections, allCollectionSlugs, allBookSlugs);
  if (hasError()) {
    console.log("\n\nPreflight check failed. Exiting.");
    process.exit(1);
  }

  await insertChapters(books, db, buildId);
  await insertBooks(books, db, buildId);
  await insertCollections(collections, db, buildId);
};
