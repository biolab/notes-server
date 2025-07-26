"use server";

import { IAnswerValueWithQuestionId } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import db from "@/utils/db";
import { getUserId } from "./UserService";

const getToken = (user: User | null) => {
  if (!user || !user.accessToken) {
    throw Error("User is not logged in.")
  }
  return user.accessToken;
}

export const postAnswer = async ({
  user,
  bookId,
  questionId,
  answer,
  correct,
  points
}: {
  user: User | null;
  bookId: number;
  questionId: string;
  answer: string;
  correct?: boolean;
  points?: number
}) => {
  const userId = await getUserId(getToken(user));
  if (!userId) {
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
    [userId, bookId, question.id, answer, correct, points]
  );
};

export const getAnswers = async ({
  user,
  bookId
}: {
  user: User | null;
  bookId: number;
}): Promise<IAnswerValueWithQuestionId[] | null> => {
  const userId = await getUserId(getToken(user));
  if (!userId) {
    throw Error("User is not found.")
  }
  return (await db.all(
    `SELECT answers.answer, q.questionId, isCorrect, points
    FROM answers
    JOIN questions q ON answers.questionId = q.id
    WHERE userId = ? AND bookId = ?
    ORDER BY answers.createdAt`,
    [userId, bookId]
  )).map(({isCorrect, ...rest}) => ({isCorrect: !!isCorrect, ...rest}));
};
