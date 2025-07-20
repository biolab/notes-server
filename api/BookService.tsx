"use server";

import db from "@/utils/db";
import { BookProps } from "@/utils/getBookProps";

export const getBookPropsFromDb = async (
  pathParts: string[]
): Promise<BookProps> => {
  const book = await db.get(`SELECT * FROM books WHERE path = ?`, [
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
      chapterDir: chapter.path,
      frontmatter: { title: chapter.title, date: chapter.date, comment: "" },
      questions,
      content: chapter.content
    });
  }

  return {
    slug: book.path,
    bookId: book.id,
    frontmatter: {
      title: book.title, subTitle: book.subTitle, description: book.description, date: book.date,
      requireLogin: book.requireLogin === 1, quizThreshold: book.quizThreshold,
      public: book.public === 1, coverImg: book.coverImg, indexInitiallyClosed: book.indexInitiallyClosed === 1,
      tocInHeader: book.tocInHeader === 1, language: book.language,
      email: { subject: book.email_subject, body: book.email_body },
    },
    chapters,
    content: book.content
  };
};
