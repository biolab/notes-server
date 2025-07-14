"use server";

import { IAnswerValue } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import db from "@/utils/db";

const getUserOrThrow = async (user: User | null) => {
  if (!user || !user.accessToken) {
    throw new Error("User missing");
  }

  const userFromDb = await db.get(
    `SELECT id, email FROM users WHERE accessToken = ? and deleted = 0`,
    [user.accessToken]
  );

  if (!userFromDb) {
    throw new Error("User not found in the database");
  }

  return userFromDb;
};

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
  const userFromDb = await getUserOrThrow(user);

  await db.run(
    `INSERT INTO answers (userId, bookId, questionId, answerValue) VALUES (?, ?, ?, ?)`,
    [userFromDb.id, bookId, id, JSON.stringify(value)]
  );
};

export const _getAnswers = async ({
  user,
  bookId,
}: {
  user: User | null;
  bookId: number;
}): Promise<IAnswerValue[] | null> => {
  const userFromDb = await getUserOrThrow(user);

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

  return events.map(
    ({ answerValue }: { answerValue: string }) =>
      JSON.parse(answerValue) as IAnswerValue
  );
};
