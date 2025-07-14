"use server";

import { IAnswerValue } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import withDb from "@/utils/db";

export const QuizService_GetState = async ({
  user,
  slug,
  quizVersion,
}: {
  user: User | null;
  slug: string;
  quizVersion: number;
}) => {
  if (!user || !user.accessToken) {
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT * FROM users WHERE accessToken = ? and deleted = 0`,
    [user.accessToken]
  );

  if (!userFromDb) {
    await db.close();
    throw new Error("User not found or deleted");
  }

  const currentState = await db.get(
    `SELECT state
     FROM quiz_states
     WHERE userId = ? AND book_slug = ? AND quiz_version = ?`,
    [userFromDb.id, slug, quizVersion]
  );

  await db.close();

  if (!currentState) {
    return null;
  }

  return JSON.parse(currentState.state);
};

export const QuizService_PostEvent = async ({
  id,
  value,
  user,
  bookId,
}: {
  id: number;
  value: IAnswerValue;
  user: User | null;
  bookId: number;
}) => {
  if (!user || !user.accessToken) {
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT id, email FROM users WHERE accessToken = ? and deleted = 0`,
    [user.accessToken]
  );

  if (!userFromDb) {
    await db.close();
    return;
  }

  await db.run(
    `INSERT INTO answers (userId, bookId, questionId, answerValue) VALUES (?, ?, ?, ?)`,
    [userFromDb.id, bookId, id, JSON.stringify(value)]
  );

  await db.close();
};

export const QuizService_GetAnswers = async ({
  user,
  bookId,
}: {
  user: User | null;
  bookId: number;
}): Promise<IAnswerValue[] | null> => {
  if (!user || !user.accessToken) {
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT id FROM users WHERE accessToken = ? and deleted = 0`,
    [user.accessToken]
  );

  if (!userFromDb) {
    await db.close();
    return null;
  }

  const events = await db.all(
    `SELECT
        answers.answerValue, 
        questions.questionId as questionId
      FROM answers
      LEFT JOIN questions ON answers.questionId = questions.id
      WHERE userId = ? AND bookId = ?
      ORDER BY answers.createdAt ASC`,
    [userFromDb.id, bookId]
  );

  await db.close();

  return events.map((event) => JSON.parse(event.answerValue) as IAnswerValue);
};
