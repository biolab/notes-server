"use server";

import db from "@/utils/db";
import { BookProps } from "@/utils/getBookProps";
import { CollectionProps } from "@/utils/getCollectionProps";

export type ItemDef = {
  type: "book" | "collection";
  id: number;
}
export const getItem = async (path: string): Promise<ItemDef | undefined> =>
  await db.get(`SELECT 'book' as type, id FROM books WHERE path = ?`, [path])
  || await db.get(`SELECT 'collection' as type, id FROM collections WHERE path = ?`, [path]);


export const getMetadata = async (path: string): Promise<{title: string, description: string} | undefined> => {
  const item = await getItem(path);
  return item && await db.get(`SELECT title, description
                       FROM ${item.type}s
                       WHERE id = ?`, [item.id]);
}

export const getBook = async (id: number, noContent=false): Promise<BookProps> => {
  const book = await db.get(`SELECT * FROM books WHERE id = ?`, [id]);

  const chapters = [];
  if (!noContent) {
    const book_chapters = await db.all(
      `SELECT books_chapters.*, chapters.*
       FROM books_chapters
                LEFT JOIN chapters ON books_chapters.chapterId = chapters.id
       WHERE books_chapters.bookId = ?`,
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
        frontmatter: {title: chapter.title, date: chapter.date, comment: ""},
        questions,
        content: chapter.content
      });
    }
  }

  return {
    slug: book.path,
    bookId: book.id,
    frontmatter: {
      title: book.title, subTitle: book.subtitle, description: book.description, date: book.date,
      requireLogin: book.requireLogin === 1, quizThreshold: book.quizThreshold,
      public: book.public === 1, coverImg: book.coverImg, indexInitiallyClosed: book.indexInitiallyClosed === 1,
      tocInHeader: book.tocInHeader === 1, language: book.language,
      email: { subject: book.email_subject, body: book.email_body },
    },
    chapters,
    content: noContent ? "" : book.content
  };
};

export const getCollection = async (id: number, noContent=false): Promise<CollectionProps> => {
  const collection = await db.get(`SELECT * FROM collections WHERE id = ?`, [id]);
  const books = [];
  const collections = [];

  if (!noContent) {
    const bookIds = (await db.all(
      `SELECT bookId
       FROM collections_books
       WHERE collectionId = ?`,
      [id])).map((row) => row.bookId);
    for (const bookId of bookIds) {
      books.push(await getBook(bookId, true));
    }

    const collectionIds = (await db.all(
      `SELECT subCollectionId
       FROM collections_collections
       WHERE collectionId = ?`,
      [id]
    )).map((row) => row.subCollectionId);
    for (const subId of collectionIds) {
      collections.push(await getCollection(subId, true));
    }
  }

  return {
    slug: collection.path,
    frontmatter: {
      title: collection.title, subTitle: collection.subtitle, description: collection.description,
      coverImg: collection.coverImg, language: collection.language, date: collection.date,
      public: collection.public === 1, recursiveContent: collection.recursiveContent === 1,
    },
    content: noContent ? "" : collection.content,
    books,
    collections,
  };
}