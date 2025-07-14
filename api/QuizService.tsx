"use server";

import { IAnswerValue } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import db from "@/utils/db";
import { _getUserOrThrow } from "./UserService";

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
  const userFromDb = await _getUserOrThrow(user);

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
  const userFromDb = await _getUserOrThrow(user);

  const events = await db.all(
    `SELECT answerValue
    FROM answers
    WHERE userId = ? AND bookId = ?
    ORDER BY answers.createdAt ASC`,
    [userFromDb.id, bookId]
  );

  return events.map(
    ({ answerValue }: { answerValue: string }) =>
      JSON.parse(answerValue) as IAnswerValue
  );
};
