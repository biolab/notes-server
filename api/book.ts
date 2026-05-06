"use server";

import db from "@/utils/db";
import { BookFrontmatter, ChapterDef, LinkDesc, UnlockChaptersOnAnswersOptions } from "@/types";
import { getPublicLink, GroupList, ItemDesc } from "@/api/content";
import { getCollection } from "@/api/collection";

export type BookProps = {
  slug: string;
  frontmatter: BookFrontmatter;
  bookId: number;
  content: string;
  chapters: ChapterDef[];
  next?: LinkDesc;
  previous?: LinkDesc;
};

export const getBookSlug = async (id: number): Promise<string | null> => {
  const book = await db.get(`SELECT path FROM books WHERE id = ?`, [id]);
  return book ? book.path : null;
}

type PrevAndNext = {next?: LinkDesc, previous?: LinkDesc};

const prevAndNext = async (bookId: number): Promise<PrevAndNext> => {
  const collectionPositions = await db.all(
    `SELECT collectionId, position FROM collections_books WHERE bookId = ?`,
    [bookId]);
  if (collectionPositions.length !== 1) {
    return {};
  }
  const {collectionId, position} = collectionPositions[0];
  if (!(await getCollection(collectionId)).slug.includes("/")) {
    return {};
  }
  if (!(await db.get(`
        SELECT COUNT(DISTINCT collectionId) = 1 as single
        FROM collections_books
        WHERE bookId IN (
          SELECT bookId FROM collections_books WHERE collectionId = ?
        )`,
        [collectionId])).single) {
      return {};
  }
  return Object.fromEntries(await Promise.all(
    [['previous', -1], ['next', 1]].map(([key, offset]) =>
      db.get(`
        SELECT '/' || b.path as href, b.title
        FROM collections_books cb
        JOIN books b on b.id = cb.bookId
        WHERE cb.collectionId = ? AND cb.position = ?`,
      [collectionId, position + offset]).then(result => [key, result]))
  ));
}

export const getBook = async (id: number): Promise<BookProps> => {
  const book = {
    ...await db.get(`SELECT * FROM books WHERE id = ?`, [id]),
    ...await prevAndNext(id)
  };
  const chapters = [];
  const book_chapters = await db.all(
    `SELECT books_chapters.*, chapters.*
     FROM books_chapters
              LEFT JOIN chapters ON books_chapters.chapterId = chapters.id
     WHERE books_chapters.bookId = ?
     ORDER BY books_chapters.position`,
    [book.id]
  );

  for (const chapter of book_chapters) {
    const questions = await db.all(
      `SELECT *
       FROM questions
       WHERE chapterId = ?
       ORDER BY position`,
      [chapter.id]
    );

    chapters.push({
      chapterPath: chapter.path,
      chapterId: chapter.id,
      frontmatter: {title: chapter.title, omitAsChapter: chapter.omitAsChapter === 1},
      questions,
      content: chapter.content
    });
  }

  const groups = (
    (await db.all(
       `SELECT groups.name, tokens.token
        FROM books_groups bg
        LEFT JOIN groups on groups.id = bg.groupId
        LEFT JOIN tokens on tokens.id = bg.tokenId
        WHERE bg.bookId = ?
        ORDER BY position`,
       [book.id])
    ) as { name: string, token: string }[]
  ).map(({ name, token }) => [name, token] as [string, string]);

  return {
    slug: book.path,
    bookId: book.id,
    frontmatter: {
      title: book.title, subTitle: book.subtitle,
      requireLogin: book.requireLogin === 1, quizThreshold: book.quizThreshold,
      unlockChaptersOnAnswers: UnlockChaptersOnAnswersOptions[book.unlockChaptersOnAnswers],
      env: JSON.parse(book.env || "{}") as Record<string, any>,
      public: book.public === 1, coverImg: book.coverImg,
      groups,
      tocInHeader: book.tocInHeader === 1, language: book.language,
    },
    chapters,
    content: book.content,
    previous: book.previous,
    next: book.next,
  };
};

export const getGroups = async (bookId: number): Promise<GroupList> =>
  (await db.all(
    `SELECT g.id, g.name
     FROM books_groups bg
     JOIN groups g on g.id = bg.groupId
     WHERE bg.bookId = ?
     ORDER BY position
    `,
    [bookId]
  )) as {id: number, name: string}[];

export const getGroupId = async (groupName: string | undefined | null, bookId: number | undefined
): Promise<number | null> => {
  if (!groupName) {
    return null;
  }
  /* JOIN on books_groups checks that the group exists for the given book */
  const row = bookId
  ? (await db.get(
    `SELECT id FROM groups g
     JOIN books_groups bg ON g.id = bg.groupId
     WHERE g.name = ? AND bg.bookId = ?`,
    [groupName, bookId]
  ))
  : await db.get(`SELECT id FROM groups WHERE name = ?`, [groupName]);
  return row ? row.id : null;
}

export const getGroupName = async (groupId: number): Promise<string | null> => {
  const row = await db.get(`SELECT name FROM groups WHERE id = ?`, [groupId]);
  return row ? row.name : null;
}

export const getCollectionsWithBook = async (bookId: number): Promise<ItemDesc[]> =>
  (await db.all(
    `SELECT collections.id, collections.path as slug, collections.title
     FROM collections
     JOIN collections_books cb ON collections.id = cb.collectionId
     WHERE cb.bookId = ? AND collections.public = 1
     `,
    [bookId]
  )) as ItemDesc[];

export const getPublicCollection = async (bookId: number): Promise<LinkDesc> =>
  getPublicLink(getCollectionsWithBook(bookId));
