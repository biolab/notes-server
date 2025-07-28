"use server";

import db from "@/utils/db";
import { BookFrontmatter, ChapterDef, CollectionFrontmatter } from "@/types/types";

const showUnpublished = process && process.env.SHOW_UNPUBLISHED === "true";

export type BookProps = {
  slug: string;
  frontmatter: BookFrontmatter;
  bookId?: number;
  content: string;
  chapters: ChapterDef[];
};

export type ItemDesc = {
  slug: string;
  title: string;
  subtitle?: string;
}

export type CollectionProps = {
  slug: string;
  frontmatter: CollectionFrontmatter;
  content: string;
  books: ItemDesc[];
  collections: ItemDesc[];
}

export type ItemDef = {
  type: "book" | "collection";
  id: number;
}
export const getItem = async (path: string): Promise<ItemDef | undefined> =>
  await db.get(`SELECT 'book' as type, id FROM books WHERE path = ?`, [path])
  || await db.get(`SELECT 'collection' as type, id FROM collections WHERE path = ?`, [path]);

export const getMetadata = async (path: string):
  Promise<{title?: string, description?: string, icons?: {icon: string}} | undefined> => {
  const item = await getItem(path);
  if (!item) {
    return;
  }
  const { title, description } = await db.get(`
    SELECT title, subtitle as description
    FROM ${item.type}s
    WHERE id = ?`, [item.id]);
  const iconPath = await db.get(`
    SELECT path
    FROM faviconpaths
    WHERE ? LIKE path || '%'
    ORDER BY LENGTH(path) DESC
    LIMIT 1;`, [path])
  return {
    title, description,
    ...iconPath ? {icons: {icon: `/${iconPath.path}/favicon.png`}} : {}
  };
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
       WHERE chapterId = ?`,
      [chapter.id]
    );

    chapters.push({
      chapterDir: chapter.path,
      chapterId: chapter.id,
      frontmatter: {title: chapter.title, date: chapter.date},
      questions,
      content: chapter.content
    });
  }

  return {
    slug: book.path,
    bookId: book.id,
    frontmatter: {
      title: book.title, subTitle: book.subtitle, date: book.date,
      requireLogin: book.requireLogin === 1, quizThreshold: book.quizThreshold,
      public: book.public === 1, coverImg: book.coverImg,
      tocInHeader: book.tocInHeader === 1, language: book.language,
      email: { subject: book.email_subject, body: book.email_body },
    },
    chapters,
    content: book.content
  };
};

export const getCollection = async (id: number): Promise<CollectionProps> => {
  const collection = await db.get(`SELECT * FROM collections WHERE id = ?`, [id]);
  const ifHidePrivate = (s: string) => showUnpublished ? "" : s;

  const books = await db.all(
    `SELECT books.path as slug, books.title, books.subtitle
     FROM collections_books coll_books
     LEFT JOIN books ON books.id = bookId
     WHERE collectionId = ?
     ${ifHidePrivate("AND (coll_books.explicit = 1 OR books.public = 1)")}
     ORDER BY position`,
    [id])

  const collections = await db.all(
    `SELECT coll.path as slug, coll.title, coll.subtitle
     FROM collections_collections coll_coll
     LEFT JOIN collections coll ON coll.id = subCollectionId
     WHERE collectionId = ?
     ${ifHidePrivate("AND (coll_coll.explicit = 1 OR coll.public = 1)")}
     ORDER BY position`,
    [id]
  )

  return {
    slug: collection.path,
    frontmatter: {
      title: collection.title, subTitle: collection.subtitle,
      coverImg: collection.coverImg, language: collection.language, date: collection.date,
      public: collection.public === 1, recursiveContent: collection.recursiveContent === 1,
    },
    content: collection.content,
    books,
    collections,
  };
}
