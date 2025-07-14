"use server";

import withDb from "@/utils/db";
import { BookProps } from "@/utils/getBookProps";

export const _getBookPropsFromDb = async (
  pathParts: string[]
): Promise<BookProps> => {
  const db = await withDb();

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

  const _chapters = [];

  for (const chapter of book_chapters) {
    const questions = await db.all(
      `SELECT *
     FROM questions
     WHERE chapterId = ?`,
      [chapter.id]
    );

    _chapters.push({
      ...JSON.parse(chapter.content),
      questions,
    });
  }

  const parsedBookContent = JSON.parse(book.content);

  return {
    bookId: book.id,
    ...parsedBookContent,
    chapters: _chapters,
  };
};
