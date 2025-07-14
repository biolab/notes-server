"use server";

import { IAnswerValue } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import withDb from "@/utils/db";

export const _postAnswer = async ({
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

export const _getAnswers = async ({
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
