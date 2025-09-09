"use server";

import db from "@/utils/db";
import { getUserId } from "@/utils/user";
import { isAdmin } from "@/api/UserService";

// Functions get user's accessToken rather than id because id's can be faked.

export const postAnswer = async (
  { accessToken, group, bookId, questionId, answer, isCorrect, points}: {
  accessToken: string;
  group: string | null;
  bookId: number;
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number
}) => {
  const userId = await getUserId(accessToken);
  const groupId = group ? (await db.get(
    `SELECT id FROM groups WHERE name = ?`,
    [group]
  ))?.id : null;

  const question = await db.get(`
    SELECT id FROM questions q
    JOIN books_chapters bc ON q.chapterId = bc.chapterId
    WHERE questionId = ? AND bc.bookId = ?
    `, [questionId, bookId]
  );
  if (!question) {
    throw Error(`Question ${questionId} not found in book with id ${bookId}`)
  }

  await db.run(
    `INSERT INTO answers (userId, bookId, groupId, questionId, answer, isCorrect, points)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, bookId, groupId, question.id, answer, isCorrect, points]
  );
};

export const getAnswers = async ({ accessToken, bookId }: {
  accessToken: string;
  bookId: number;
}) =>
  (await db.all(
    `SELECT answers.answer, q.questionId, isCorrect, points
    FROM answers
    JOIN questions q ON answers.questionId = q.id
    WHERE userId = ? AND bookId = ?
    ORDER BY answers.createdAt`,
    [await getUserId(accessToken), bookId]
  )).map(({isCorrect, ...rest}) => ({
    // DB stores 0 and 1 even if the column is declared as BOOLEAN
    isCorrect: isCorrect === null ? undefined : !!isCorrect,
    ...rest}));

export type AnswerRecord = {
  createdAt: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
};

export type QuestionRecord = {
  dbId: number;
  questionId: string;
  question: string;
  chapterTitle: string;
  bookTitle: string;
}

export type UsersAnswers = {
    [questionId: string]:
      AnswerRecord[]
}

export type UserDesc = {
  userId: number,
  groupId: number,
  name: string,
  surname: string,
  email: string,
}

type AnswerRow = UserDesc & { answers: UsersAnswers };
export type AnswersInBook = AnswerRow[];

export const getAnswersInBook = async (bookId: number, accessToken: string): Promise<AnswersInBook | false> => {
  if (!await isAdmin(accessToken)) {
    return false;
  }
  const resultTable: AnswersInBook = [];
  let lastRow: AnswerRow | undefined;
  (
    (await db.all(`
      SELECT a.createdAt,
             a.userId, 
             a.groupId,
             u.name,
             u.surname,
             u.email,
             a.answer,
             a.isCorrect,
             a.points,
             a.questionId
      FROM answers a
      JOIN users u ON a.userId = u.id
      WHERE a.bookId = ?
      ORDER BY a.userId, a.groupId, a.createdAt`,
      [bookId]
    )) as (AnswerRecord & UserDesc & {
      bookId: number, questionId: string})[]
  )
  .forEach(({isCorrect, userId, groupId, questionId, name, surname, email, ...rest}) => {
    // Different SQL dialects have different ways to do this, so we do it in JS
    if (userId !== lastRow?.userId || groupId !== lastRow?.groupId) {
      lastRow = {userId, groupId, name, surname, email, answers: {}}
      resultTable.push(lastRow);
    }
    lastRow.answers[questionId] ||= [];
    lastRow.answers[questionId].push({
      isCorrect: isCorrect === null ? undefined : !!isCorrect,
      ...rest
    });
  });
  return resultTable;
}

export const getQuestionsInBook = async (bookId: number): Promise<QuestionRecord[]> =>
  (await db.all(
    `SELECT q.id as dbId, q.questionId, q.question, c.title as chapterTitle, b.title as bookTitle 
     FROM books b
     JOIN books_chapters bc ON b.id = bc.bookId
     JOIN chapters c ON bc.chapterId = c.id
     JOIN questions q ON bc.chapterId = q.chapterId
     WHERE b.id = ?
     ORDER BY bc.position, q.position`,
    [bookId]
  )) as QuestionRecord[];

export const getBookHasQuestions = async (bookId: number): Promise<boolean> =>
  !!(await db.get(
    `SELECT DISTINCT 1 
     FROM books b
     JOIN books_chapters bc ON b.id = bc.bookId
     JOIN chapters c ON bc.chapterId = c.id
     JOIN questions q ON bc.chapterId = q.chapterId
     WHERE b.id = ?`,
    [bookId]
  ));

export type UsersPoints = {
  [bookId: number]: number
}

type PointsRow = UserDesc & { points: UsersPoints };
export type PointsInCollection = PointsRow[];

export const getCollectionResults = async (collectionId: number, accessToken: string): Promise<PointsInCollection | false> => {
  if (!await isAdmin(accessToken)) {
    return false;
  }

  const results: PointsInCollection = [];
  let lastRow: PointsRow | undefined;
  (
    (await db.all(
      `SELECT u.id as userId,
              u.name,
              u.surname,
              u.email,
              a.groupId,
              b.id as bookId,
              b.title,
              SUM(a.points) AS points
       FROM collections
       JOIN collections_books cb ON collections.id = cb.collectionId
       JOIN books_chapters bc ON cb.bookId = bc.bookId
       JOIN books b ON cb.bookId = b.id
       JOIN questions q ON bc.chapterId = q.chapterId
       JOIN answers a ON q.id = a.questionId
       JOIN users u ON a.userId = u.id
       WHERE collections.id = ?
       GROUP BY u.id, a.groupId, b.id
       ORDER BY u.id`,
      [collectionId]
    )) as (UserDesc & { bookId: number, title: string, points: number })[]
  )
    .forEach(({userId, groupId, name, surname, email, bookId, points}) => {
      if (userId != lastRow?.userId || groupId != lastRow?.groupId) {
        lastRow = {userId, groupId, name, surname, email, points: {}};
        results.push(lastRow);
      }
      lastRow.points[bookId] = points;
    });
  return results;
}

export const getCollectionHasQuestions = async (collectionId: number): Promise<boolean> =>
  !!(await db.all(
    `SELECT DISTINCT 1
       FROM collections
       JOIN collections_books cb ON collections.id = cb.collectionId
       JOIN books_chapters bc ON cb.bookId = bc.bookId
       JOIN books b ON cb.bookId = b.id
       JOIN questions q ON bc.chapterId = q.chapterId
       WHERE collections.id = ?`,
    [collectionId]
  ));
