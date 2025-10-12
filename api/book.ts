"use server";

import db from "@/utils/db";
import { BookFrontmatter, ChapterDef } from "@/types";
import { getPublicLink, GroupList, ItemDesc, LinkDesc } from "@/api/content";


export type BookProps = {
  slug: string;
  frontmatter: BookFrontmatter;
  bookId: number;
  content: string;
  chapters: ChapterDef[];
};

export const getBookSlug = async (id: number): Promise<string | null> => {
  const book = await db.get(`SELECT path FROM books WHERE id = ?`, [id]);
  return book ? book.path : null;
}

export const getBook = async (id: number): Promise<BookProps> => {
  const book = await db.get(`SELECT * FROM books WHERE id = ?`, [id]);

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
      chapterDir: chapter.path,
      chapterId: chapter.id,
      frontmatter: {title: chapter.title},
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
        WHERE bg.bookId = ?`,
       [book.id])
    ) as { name: string, token: string }[]
  ).map(({ name, token }) => [name, token] as [string, string]);

  return {
    slug: book.path,
    bookId: book.id,
    frontmatter: {
      title: book.title, subTitle: book.subtitle,
      requireLogin: book.requireLogin === 1, quizThreshold: book.quizThreshold,
      public: book.public === 1, coverImg: book.coverImg,
      groups,
      tocInHeader: book.tocInHeader === 1, language: book.language,
    },
    chapters,
    content: book.content
  };
};

export const getGroups = async (bookId: number): Promise<GroupList> =>
  (await db.all(
    `SELECT g.id, g.name
     FROM books_groups bg
     JOIN groups g on g.id = bg.groupId
     WHERE bg.bookId = ?`,
    [bookId]
  )) as {id: number, name: string}[];

export const getGroupId = async (groupName: string, bookId: number | undefined
): Promise<number | null> => {
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
