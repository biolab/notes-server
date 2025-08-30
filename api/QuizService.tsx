"use server";

import { AnswerWithQuestionId } from "@/context/QuizContextProvider";
import db from "@/utils/db";
import { User } from "./UserService";

// TODO: these functions don't need `user`; userId is enough

export const postAnswer = async ({
  user,
  bookId,
  questionId,
  answer,
  isCorrect,
  points
}: {
  user: User | null;
  bookId: number;
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number
}) => {
  if (!user) {
    throw Error("User is not found.")
  }
  const question = await db.get(`
  SELECT id FROM questions q
  JOIN books_chapters bc ON q.chapterId = bc.chapterId
  WHERE questionId = ? AND bc.bookId = ?
  `, [questionId, bookId]);
  if (!question) {
    throw Error(`Question ${questionId} not found in book with id ${bookId}`)
  }
  await db.run(
    `INSERT INTO answers (userId, bookId, questionId, answer, isCorrect, points)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, bookId, question.id, answer, isCorrect, points]
  );
};

export const getAnswers = async ({
  user,
  bookId
}: {
  user: User | null;
  bookId: number;
}): Promise<AnswerWithQuestionId[] | null> => {
  if (!user) {
    throw Error("User is not found.")
  }
  return (await db.all(
    `SELECT answers.answer, q.questionId, isCorrect, points
    FROM answers
    JOIN questions q ON answers.questionId = q.id
    WHERE userId = ? AND bookId = ?
    ORDER BY answers.createdAt`,
    [user.id, bookId]
  )).map(({isCorrect, ...rest}) => ({
    // DB stores 0 and 1 even if the column is declared as BOOLEAN
    isCorrect: isCorrect === null ? undefined : !!isCorrect,
    ...rest}));
};

export type AnswerRecord = {
  createdAt: string;
  userId: number;
  userEmail?: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
  questionId: string;
};

export type QuestionRecord = {
  questionId: string;
  question: string;
  chapterTitle: string;
  bookTitle: string;
}

export const getAnswersInBooks = async (bookIds: number[]): Promise<AnswerRecord[]> =>
  ((await db.all(
    `SELECT a.createdAt, a.userId, u.email as userEmail,
            a.answer, a.isCorrect, a.points, a.questionId
    FROM answers a 
    JOIN users u ON a.userId = u.id
    WHERE a.bookId ${
      bookIds.length == 1 ? "= ?" : `IN (${bookIds.map(() => '?').join(', ')})`
    }
    ORDER BY a.createdAt` ,
    bookIds
  )) as AnswerRecord[]).map(({isCorrect, ...rest}) => ({
    // DB stores 0 and 1 even if the column is declared as BOOLEAN
    isCorrect: isCorrect === null ? undefined : !!isCorrect,
    ...rest}))

export const getQuestionsInBooks = async (bookIds: number[]): Promise<QuestionRecord[]> =>
  (await db.all(
    `SELECT q.questionId, q.question, c.title as chapterTitle, b.title as bookTitle 
     FROM books b
     JOIN books_chapters bc ON b.id = bc.bookId
     JOIN chapters c ON bc.chapterId = c.id
     JOIN questions q ON bc.chapterId = q.chapterId
     WHERE b.id ${
             bookIds.length == 1 ? "= ?" : `IN (${bookIds.map(() => '?').join(', ')})`
     }
     ORDER BY bc.position`,
    bookIds
  )) as QuestionRecord[]
