import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { catchErrors, hasError, logError, serializedContent } from "./helpers";
import { getImageSize } from "./getImageSize";
import { Database } from "sqlite";

import { compile } from "@mdx-js/mdx";
import * as babelParser from "@babel/parser";
import * as t from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";

import {
  getRawCollection,
  RawCollectionProps,
} from "@/ingest/collection";
import {
  getBookProps,
  getRawBook, RawBookProps,

} from "@/ingest/book";
import { BookProps, ChapterDef, ChapterFrontmatter } from "@/types/types";

type QuestionTypes = "multi" | "text" | "long-text" | "choice";

export type QuestionDef = {
  id?: number;
  questionId: string;
  question: string;
  type: QuestionTypes;
  options: string[] | null;
  answer: string | null;
  line: number;
  points: number;
  optional: boolean;
};

export const extractQuizzes = async (
  mdxSource: string,
  slug: string
): Promise<QuestionDef[]> => {
  const compiledMdx = await compile(
    // At some point I used mdxSource.replace(/[^\x00-\x7F]/g, "") to fix some problem.
    // Later it turned out it makes options non-unique (e.g. in `options={["Č", "Š", "Ž"]}`).
    // I removed it and it still works. I'm keeping the comment, just for the case.
    mdxSource,
    {
      outputFormat: "function-body",
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, getImageSize],
    }
  );
  const ast = babelParser.parse(`() => {${String(compiledMdx)}}`, {
    sourceType: "module",
    plugins: [],
  });

  const questions: QuestionDef[] = [];
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const args = path.node.arguments;
      if (
        args.length > 1 &&
        t.isIdentifier(args[0]) &&
        args[0].name === "Quiz"
      ) {
        const props = args[1];
        if (t.isObjectExpression(props)) {
          const findProp = (name: string): t.ObjectProperty | undefined =>
            props.properties.find(
              (prop): prop is t.ObjectProperty =>
                t.isObjectProperty(prop) &&
                t.isIdentifier(prop.key) &&
                prop.key.name === name
            );

          const getProp = (where: string, name: string): string | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isStringLiteral(prop.value)) {
              logError(where, `Property "${name}" is not a string`);
              return null;
            }
            return prop.value.value;
          };

          const getNumProp = (where: string, name: string): number | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (
              !(
                t.isNumericLiteral(prop.value) || t.isDecimalLiteral(prop.value)
              )
            ) {
              logError(
                where,
                `
                Property "${name}" is not a number.
                Value:
                ${JSON.stringify(prop.value)}`
              );
              return null;
            }

            if (t.isNumericLiteral(prop.value)) {
              return prop.value.value;
            }

            return parseInt(prop.value.value);
          };

          const getBoolProp = (where: string, name: string): boolean | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isBooleanLiteral(prop.value)) {
              logError(where, `Property "${name}" is not a boolean`);
              return null;
            }

            return prop.value.value;
          };

          const getPropArray = (
            where: string,
            name: string
          ): string[] | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isArrayExpression(prop.value)) {
              logError(where, `"${name}" is not an array`);
              return null;
            }
            const elements = prop.value.elements;
            const strings: string[] = [];
            for (const el of elements) {
              if (!t.isStringLiteral(el)) {
                logError(
                  where,
                  `"${name}" contains a non-string element in array`
                );
                return null;
              }
              if (!el.value.length) {
                console.log(el);
              }
              strings.push(el.value);
            }
            return strings;
          };

          const question = getProp(slug, "question");
          if (!question) {
            logError(slug, "Question text is missing");
            return;
          }
          const where = `${slug}:\n  ${question.slice(0, 50)}${
            question.length > 50 ? "(...)" : ""
          }`;

          const type = getProp(where, "type") || "multi";
          if (["multi", "text", "long-text", "choice"].indexOf(type) === -1) {
            logError(
              where,
              `Question type "${type}" is not supported. Use "multi", "text" or "long-text".`
            );
            return;
          }

          const questionId = getProp(where, "id") || question;
          const points = getNumProp(where, "points") || 0;
          const optional = getBoolProp(where, "optional") ?? false;
          const options = getPropArray(where, "options");
          const answer = getProp(where, "answer");
          const newErrors: string[] = (
            [
              /* Add more as needed */
              [
                options &&
                  answer &&
                  !options
                    .map((s) => s.toLocaleLowerCase())
                    .includes(answer.toLocaleLowerCase()),
                `Correct answer is not listed in options`,
              ],
              [
                options && new Set(options).size != options.length,
                `Options are not unique`,
              ],
              [
                options && type !== "multi" && type !== "choice",
                "Options are only allowed for multi-choice questions",
              ],
              [
                (type === "multi" || type === "choice") && !options,
                "Options are required for multi-choice questions",
              ],
            ] as [boolean, string][]
          )
            .filter(([cond]) => cond)
            .map(([, error]) => error);

          if (newErrors.length > 0) {
            newErrors.forEach((error) => logError(where, error));
          }
          // We add invalid questions so that they're not reported as missing.
          // Build will fail, so they won't be added to the database.
          questions.push({
            questionId,
            question,
            type: type as QuestionTypes,
            options,
            answer,
            points,
            optional,

            line: path.node.loc?.start.line || -1,
          });
        }
      }
    },
  });
  return questions;
};

const checkBooks = async (
  books: RawBookProps[],
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
      await serializedContent(book.rawContent, book.frontmatter.language)
    );

    // Check that chapters' content can be serialized
    for (const { rawContent, chapterDir } of book.chapters) {
      await catchErrors(chapterDir, async () =>
        serializedContent(rawContent, book.frontmatter.language)
      );
    }

    /* Question-related checks
       Note that any book-specific issues must be checked here, not in checkQuestions.
       e.g., if the same question comes from another chapter, it's OK.
       e.g. (2), if a chapter with a question is removed, it is not OK.
     */

    // Extract all questions in the book
    type QuestionAndChapter = { chapter: string; question: QuestionDef };
    const questions: QuestionAndChapter[] = [];
    for (const { rawContent, chapterDir, frontmatter } of book.chapters) {
      const chapterQuestions = await extractQuizzes(
        rawContent,
        `${book.slug}:${chapterDir}`
      );
      questions.push(
        ...chapterQuestions.map((question) => ({
          chapter: chapterDir,
          question,
        }))
      );
      chapters[chapterDir] = { frontmatter, questions: chapterQuestions };
    }

    // Check that no questions within the same book have the same questionId
    const questionsByIds: Record<string, QuestionAndChapter[]> = {};
    for (const { chapter, question } of questions) {
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
      const extras = questions.filter(
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
  collections: RawCollectionProps[],
  allCollectionSlugs: Set<string>,
  allBookSlugs: Set<string>
) => {
  for (const collection of collections) {
    // Check that collection content can be serialized
    await catchErrors(collection.slug, async () =>
      serializedContent(collection.rawContent, collection.frontmatter.language)
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
  serializedChapters: ChapterDef[],
  db: Database,
  buildId: number
) => {
  for (const {chapterDir, content, questions, frontmatter: {title, omitAsChapter}} of serializedChapters) {
    const chapterId = (
      await db.get(
        `
      INSERT INTO chapters (lastBuildId, path, title, omitAsChapter, content)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET title       = excluded.title,
                                      lastBuildId = excluded.lastBuildId,
                                      content     = excluded.content,
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
        ON CONFLICT DO UPDATE SET question = excluded.question,
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
};

const insertBooks = async (
  books: BookProps[],
  db: Database,
  buildId: number
) => {
  for (const {
    content,
    chapters,
    slug,
    frontmatter: { title, subTitle, description, date, public: isPublic, language, tocInHeader, indexInitiallyClosed, coverImg, requireLogin, quizThreshold, loginSubtitle, email },
  } of books) {
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
  collections: RawCollectionProps[],
  db: Database,
  buildId: number
) => {
  for (const {
    slug: collectionSlug,
    frontmatter: { title, subTitle, date, description, public: isPublic, language, coverImg, recursiveContent },
  } of collections) {
    // Do not change this to "DELETE + INSERT" because it will delete rows that use this collections's id as foreign key.
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
  const rawBooks = await Promise.all(bookSlugs.map(getRawBook));
  const serializedBooks = await Promise.all(bookSlugs.map(getBookProps));
  const allBookSlugs = new Set(rawBooks.map(({ slug }) => slug));
  const collections = await Promise.all(
    collectionSlugs.map(async (slug) => await getRawCollection(slug))
  );
  const allCollectionSlugs = new Set(collections.map(({ slug }) => slug));

  const chapters = await checkBooks(rawBooks, allBookSlugs, db, pathPrefix);
  await checkQuestions(chapters, db);
  await checkCollections(collections, allCollectionSlugs, allBookSlugs);
  if (hasError()) {
    console.log("\n\nPreflight check failed. Exiting.");
    process.exit(1);
  }

  await insertChapters(
    serializedBooks.flatMap((b) => b.chapters),
    db,
    buildId
  );
  await insertBooks(serializedBooks, db, buildId);
  await insertCollections(collections, db, buildId);
};
