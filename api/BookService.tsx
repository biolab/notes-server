"use server";

import db from "@/utils/db";
import { BookProps } from "@/utils/getBookProps";

export const getBookPropsFromDb = async (
  pathParts: string[]
): Promise<BookProps> => {
  const book = await db.get(`SELECT id, content FROM books WHERE path = ?`, [
    pathParts.join("/"),
  ]);

  const book_chapters = await db.all(
    `SELECT books_chapters.*, chapters.*
     FROM books_chapters
     LEFT JOIN chapters ON books_chapters.chapterId = chapters.id
     WHERE books_chapters.bookId = ?`,
    [book.id]
  );

  const chapters = [];

  for (const chapter of book_chapters) {
    const questions = await db.all(
      `SELECT *
     FROM questions
     WHERE chapterId = ?`,
      [chapter.id]
    );

    chapters.push({
      ...JSON.parse(chapter.content),
      questions,
    });
  }

  const parsedBookContent = JSON.parse(book.content);

  return {
    bookId: book.id,
    ...parsedBookContent,
    chapters,
  };
};
