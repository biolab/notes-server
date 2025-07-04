"use server";

import { EventTypes } from "@/components/Quiz/Quiz";
import { QuizStateI } from "@/context/QuizContextProvider";
import { User } from "@/context/UserContextProvider";
import withDb from "@/utils/db";

export const QuizService_PostState = async ({
  quizState,
  user,
  slug,
  quizVersion,
  submissionMail,
}: {
  quizState: QuizStateI;
  user: User | null;
  slug: string;
  quizVersion: number;
  submissionMail?: string;
}) => {
  if (!user || !user.access_token) {
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT id, email FROM users WHERE access_token = ? and deleted = 0`,
    [user.access_token]
  );

  if (!userFromDb) {
    await db.close();
    throw new Error("User not found or deleted");
  }

  const currentState = await db.get(
    `SELECT id, state, submission_sent FROM quiz_states WHERE user_id = ? AND book_slug = ? AND quiz_version = ?`,
    [userFromDb.id, slug, quizVersion]
  );

  const isComplete = quizState.isQuizComplete ? 1 : 0;
  const shouldSendSubmissionEmail =
    isComplete && submissionMail && !currentState?.submission_sent;

  if (shouldSendSubmissionEmail) {
    // await EmailService.sendMail();
  }

  const submission_sent =
    currentState?.submission_sent || shouldSendSubmissionEmail ? 1 : 0;

  if (currentState) {
    await db.run(
      `UPDATE quiz_states SET state = ?, submission_sent = ?,is_quiz_complete = ? ,  updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(quizState), submission_sent, isComplete, currentState.id]
    );
  } else {
    await db.run(
      `INSERT INTO quiz_states (user_id, book_slug, state, quiz_version, submission_sent, is_quiz_complete) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userFromDb.id,
        slug,
        JSON.stringify(quizState),
        quizVersion,
        submission_sent,
        isComplete,
      ]
    );
  }

  await db.close();
};

export const QuizService_PostEvent = async ({
  value,
  user,
  type,
  slug,
}: {
  value: QuizStateI;
  user: User | null;
  type: EventTypes;
  slug: string;
}) => {
  if (!user || !user.access_token) {
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT id, email FROM users WHERE access_token = ? and deleted = 0`,
    [user.access_token]
  );

  if (!userFromDb) {
    await db.close();
    return;
  }

  await db.run(
    `INSERT INTO events (user_id, book_slug, event_type, value) VALUES (?, ?, ?, ?)`,
    [userFromDb.id, slug, type, JSON.stringify(value)]
  );

  await db.close();
};

export const QuizService_GetState = async ({
  user,
  slug,
  quizVersion,
}: {
  user: User | null;
  slug: string;
  quizVersion: number;
}) => {
  if (!user || !user.access_token) {
    console.log("no user");
    return null;
  }

  const db = await withDb();

  const userFromDb = await db.get(
    `SELECT * FROM users WHERE access_token = ? and deleted = 0`,
    [user.access_token]
  );

  if (!userFromDb) {
    await db.close();
    throw new Error("User not found or deleted");
  }

  const currentState = await db.get(
    `SELECT state
     FROM quiz_states
     WHERE user_id = ? AND book_slug = ? AND quiz_version = ?`,
    [userFromDb.id, slug, quizVersion]
  );

  await db.close();

  if (!currentState) {
    return null;
  }

  return JSON.parse(currentState.state);
};
