"use server";

import db from "@/utils/db";
import { getUserId } from "@/utils/user";
import { isAdminFor } from "@/api/user";
import {getGroupId} from "@/api/book";
import {QuestionDef} from "@/types";
import {AnswerFile, AnswerValue} from "@/context/QuizContextProvider";

/* Functions in this module get user's accessToken rather than id
   because id's can be faked.
 */

export const getQId = async (bookId: number, questionId: string) => {
  const question = await db.get(`
    SELECT id FROM questions q
    JOIN books_chapters bc ON q.chapterId = bc.chapterId
    WHERE questionId = ? AND bc.bookId = ?
    `, [questionId, bookId]
  );
  if (!question) {
    throw Error(`Question ${questionId} not found in book with id ${bookId}`)
  }
  return question.id;
}

export const getQuestionIdFromId = async (id: number) => {
  const question = await db.get(`SELECT questionId FROM questions WHERE id = ?`, [id]);
  return question ? question.questionId : null;
}

export type PostAnswerResult =
 { status: "error",
   message: string} |
 { status: "ok",
   isCorrect: boolean | undefined;
   points: number,
   correctAnswer?: string };

const getQuestion = async (questionId: string, bookId: number): Promise<QuestionDef> => {
  const question = await db.get(`
  SELECT id, answer, maxPoints, maxAttempts, type
  FROM questions q
  JOIN books_chapters bc ON q.chapterId = bc.chapterId
  WHERE questionId = ? AND bc.bookId = ?`,
    [questionId, bookId]
  );
  if (!question) {
    throw Error("Question id and book id don't match");
  }
  return question;
}

const checkAllowedAttempts = async ({ userId, groupId, bookId, qId, maxAttempts}: {
  userId: number;
  groupId: number | null;
  bookId: number;
  qId: number;
  maxAttempts: number | null;
}) => {
  const nPastAnswers = await db.all(`
      SELECT id
      FROM answers
      WHERE userId = ? AND bookId = ? AND groupId IS ? AND questionId = ?
      ORDER BY createdAt DESC
  `, [userId, bookId, groupId, qId]) as {id: number}[];
  if (maxAttempts && nPastAnswers.length >= maxAttempts) {
    throw Error("Maximum number of attempts reached");
  }
  return {nPastAttempts: nPastAnswers.length, lastAttemptId: nPastAnswers[0]?.id};
}

export const getPostAnswerData = async (
  { accessToken, group, bookId, questionId}:
  { accessToken: string;
    group: string | null | number;
    bookId: number;
    questionId: string;
}) => {
  const userId = await getUserId(accessToken);
  const groupId = typeof group === "number" ? group : await getGroupId(group, bookId);
  const question = await getQuestion(questionId, bookId);
  const {nPastAttempts, lastAttemptId} = await checkAllowedAttempts(
    {userId, groupId, bookId, qId: question.id!, maxAttempts: question.maxAttempts});
  return {question, userId, groupId, nPastAttempts, lastAttemptId};
}

export const postAnswer = async (
  { accessToken, group, bookId, questionId, answer, isCorrect, points}: {
  accessToken: string;
  group: string | null;
  bookId: number;
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number
}): Promise<PostAnswerResult> => {
  let qData: Awaited<ReturnType<typeof getPostAnswerData>>;
  try { qData = await getPostAnswerData({accessToken, group, bookId, questionId}); }
  catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error)};
  }
  const {question, userId, groupId, nPastAttempts} = qData;
  if (question.type.startsWith("upload")) {
    throw Error("This question requires file upload and cannot be answered with this endpoint.");
  }
  /* If we have the answer in the database, we check the submitted answer
     and assign points. Otherwise, we trust the received isCorrect and points.
   */
  const actCorrect =
    !question.answer ? isCorrect
    : question.type === "singlechoice" ? question.answer === answer
    : question.answer.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase()
  const actPoints = !question.answer
    ? points || 0
    : actCorrect && question.maxPoints || 0;

  await db.run(
    `INSERT INTO answers (userId, bookId, groupId, questionId, answer, isCorrect, points)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, bookId, groupId, question.id, answer, actCorrect, actPoints]
  );

  const shownAnswer =
    (question.maxAttempts
     && nPastAttempts + 1 >= question.maxAttempts
     && question.answer) ? { correctAnswer: question.answer } : {};
  return {
    status: "ok",
    isCorrect: actCorrect,
    points: actPoints,
    ...shownAnswer};
};

export const postFileAnswer = async (
  { accessToken, group, bookId, questionId, dontCreate
}: {
  accessToken: string;
  group: string | null;
  bookId: number;
  questionId: string;
  dontCreate?: boolean;
}) => {
  let qData: Awaited<ReturnType<typeof getPostAnswerData>>;
  try { qData = await getPostAnswerData({accessToken, group, bookId, questionId}); }
  catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error)};
  }
  const {question, userId, groupId, lastAttemptId} = qData;
  if (!question.type.startsWith("upload")) {
    return { status: "error", message: "Question is not of upload type" };
  }
  if (lastAttemptId) {
    await db.run("UPDATE answers SET createdAt = CURRENT_TIMESTAMP  WHERE id = ?", [lastAttemptId]);
    return { status: "ok", answerId: lastAttemptId };
  }
  else if (dontCreate) {
    return { status: "error", message: "No existing answer found for this question" };
  }
  else {
    const answerId = (await db.get(
      `INSERT INTO answers (userId, bookId, groupId, questionId, answer)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
      [userId, bookId, groupId, question.id, ""]
    )).id;
    return { status: "ok", answerId };
  }
};

export type CorrectAnswers = { questionId: string, answer: string }[];

export const getLastAnswers = async ({ accessToken, bookId, group }: {
  accessToken: string;
  bookId: number;
  group: string | undefined | null;
}) => {
  const userId = await getUserId(accessToken);
  const answers = [
    ...(
      await db.all(`
        SELECT answer, questionId, isCorrect, points, nAttempts FROM (
          SELECT a.answer, q.questionId, a.isCorrect, a.points,
                 ROW_NUMBER() OVER (PARTITION BY a.questionId ORDER BY a.createdAt DESC) AS rn,
                 COUNT(*) OVER (PARTITION BY a.questionId) AS nAttempts
          FROM answers a
          JOIN questions q ON a.questionId = q.id
          LEFT JOIN groups g ON a.groupId = g.id
          WHERE a.userId = ? AND a.bookId = ? AND g.name IS ? AND q.type NOT LIKE 'upload%'
        ) t
        WHERE rn = 1;`,
        [userId, bookId, group ?? null]
      )).map(({answer, questionId, isCorrect, points, nAttempts}) => ({
        type: "value",
        answer,
        questionId,
        points,
        nAttempts,
        // DB stores 0 and 1 even if the column is declared as BOOLEAN
        isCorrect: isCorrect === null ? undefined : !!isCorrect,
      }) as AnswerValue & {questionId: string, nAttempts: number}),
    ...(
      await db.all(`
        SELECT questionId, group_concat(u.filename, "\n") as files, 1 as nAttempts FROM (
          SELECT q.questionId, a.id as answerId,
                 ROW_NUMBER() OVER (PARTITION BY a.questionId ORDER BY a.createdAt DESC) AS rn
          FROM answers a
          JOIN questions q ON a.questionId = q.id
          LEFT JOIN groups g ON a.groupId = g.id
          WHERE userId = ? AND bookId = ? AND g.name IS ? AND q.type LIKE 'upload%'
        ) t
        JOIN uploads u ON u.answerId = t.answerId
        WHERE rn = 1
        GROUP BY t.answerId;`,
        [userId, bookId, group ?? null]
      )).map(({files, questionId, nAttempts}) => ({
        type: "files",
        questionId,
        nAttempts,
        files: files ? files.split("\n") : [],
      }) as AnswerFile & {questionId: string, nAttempts: number})
  ];

  const correctAnswers =
    (await db.all(`
      SELECT q.questionId, q.answer
      FROM questions q
      JOIN books_chapters bc ON q.chapterId = bc.chapterId
      WHERE bc.bookId = ?
        AND q.answer IS NOT NULL
        AND (SELECT COUNT(*)
             FROM answers a
             LEFT JOIN groups g ON a.groupId = g.id
             WHERE a.questionId = q.id
             AND userId = ? AND bookId = ? AND g.name IS ?
      ) >= q.maxAttempts`,
      [bookId, userId, bookId, group]
    ) as CorrectAnswers);
  return {answers, correctAnswers};
}

export type AnswerRecord = {
  createdAt: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
};

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

export const getAnswersInBook = async (
  bookId: number,
  accessToken: string,
  groupId: number | null = null
): Promise<AnswersInBook | false> => {
  if (!await isAdminFor({accessToken, bookId})) {
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
             CASE
                 WHEN q.type LIKE 'upload%'
                     THEN IFNULL(group_concat(up.filename, ", "), "")
                 ELSE a.answer
             END AS answer,
             a.isCorrect,
             a.points,
             q.questionId
      FROM answers a
      JOIN users u ON a.userId = u.id
      JOIN questions q ON a.questionId = q.id
      LEFT JOIN uploads up ON up.answerId = a.id
      WHERE a.bookId = ? ${groupId ? "AND a.groupId = ?" : ""}
      GROUP BY a.id
      HAVING (q.type NOT LIKE 'upload%') OR (q.type LIKE 'upload%' AND count(up.answerId) > 0)
      ORDER BY a.userId, a.groupId, a.createdAt`,
      [bookId, ...(groupId ? [groupId] : [])]
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

type FileAnswersInBook = {
  groupId: number,
  qId: number,
  accessToken: string,
  fileNames: string[],
  group: string,
  userId: number,
  name: string | null,
  surname: string | null,
  email: string | null,
  questionId: string,
};

export const getAnswersFilesInBook = async (
  bookId: number,
  accessToken: string,
  groupId: number | null = null
): Promise<FileAnswersInBook[] | false> =>
  (await isAdminFor({accessToken, bookId})
  ) && (
    (await db.all(`
      SELECT groupId, qId, accessToken, answer, "group", userId, name, surname, email, questionId
      FROM (
        SELECT a.groupId,
               q.id as qId,
               u.accessToken,
               group_concat(up.filename, "\n") as answer,
               g.name as "group",
               u.id as userId,
               u.name,
               u.surname,
               u.email,
               q.questionId,
               ROW_NUMBER() OVER (PARTITION BY a.userId, a.groupId, q.id ORDER BY a.createdAt DESC) AS rn
        FROM answers a
        JOIN users u ON a.userId = u.id
        JOIN questions q ON a.questionId = q.id AND q.type LIKE 'upload%'
        LEFT JOIN groups g ON a.groupId = g.id OR (a.groupId IS NULL AND g.id IS NULL)
        JOIN uploads up ON up.answerId = a.id
        WHERE a.bookId = ? ${groupId ? "AND a.groupId = ?" : ""}
        GROUP BY a.id
      )
      WHERE rn = 1; 
      `,
      [bookId, ...(groupId ? [groupId] : [])]
    )) as (Omit<FileAnswersInBook, "fileNames"> & {answer: string})[]
  )
  .map(({answer, ...rest}) => ({fileNames: answer.split("\n"), ...rest}));

type UserFileAnswersInBook = {
  questionId: string;
  group: string;
  groupId: number;
  accessToken: string;
  qId: number;
  fileNames: string[]
};

export const getUserFilesInBook = async (
  {bookId, userId, accessToken, groupId, qId}:
{ bookId: number;
  userId: string;
  accessToken: string;
  groupId: number | null;
  qId: number | null;
}) : Promise<UserFileAnswersInBook[] | false> =>
  (await isAdminFor({accessToken, bookId})
  ) && (
    (await db.all(`
      SELECT groupId, qId, accessToken, answer, "group", questionId
      FROM (
        SELECT
          a.groupId,
          q.id as qId,
          u.accessToken,
          group_concat(up.filename, ":") as answer,
          g.name as "group",
          q.questionId,
          ROW_NUMBER() OVER (PARTITION BY q.id ORDER BY a.createdAt DESC) AS rn
          FROM answers a
          JOIN users u ON u.id = ? AND a.userId = u.id
          JOIN questions q ON a.questionId = q.id AND q.type LIKE 'upload%'
          LEFT JOIN groups g ON a.groupId = g.id OR (a.groupId IS NULL AND g.id IS NULL)
          JOIN uploads up ON up.answerId = a.id
          WHERE a.bookId = ?
                ${groupId ? "AND a.groupId = ?" : ""}
                ${qId ? "AND q.id = ?" : ""}
          GROUP BY a.id
          )
      WHERE rn = 1;
      `,
      [userId, bookId, ...(groupId ? [groupId] : []), ...(qId ? [qId] : [])]
    )) as (Omit<UserFileAnswersInBook, "fileNames"> & {answer: string})[]
  ).map(({answer, ...rest}) => ({fileNames: answer.split(":"), ...rest}));

export type UsersPoints = {
  [bookId: number]: number
}

type PointsRow = UserDesc & { points: UsersPoints };
export type PointsInCollection = PointsRow[];

export const getCollectionResults = async (
  collectionId: number,
  accessToken: string,
  groupId: number | null = null
): Promise<PointsInCollection | false> => {
  if (!await isAdminFor({accessToken, collectionId})) {
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
       WHERE collections.id = ? ${groupId ? "AND a.groupId = ?" : ""}
       GROUP BY u.id, a.groupId, b.id
       ORDER BY u.id`,
      [collectionId, ...(groupId ? [groupId] : [])]
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

export const getCollectionBooksWithQuestions = async (collectionId: number): Promise<Record<number, number | null>> =>
  Object.fromEntries(
    (await db.all(
      `SELECT b.id as bookId, b.quizThreshold * SUM(q.maxPoints) as threshold
       FROM collections
       JOIN collections_books cb ON collections.id = cb.collectionId
       JOIN books_chapters bc ON cb.bookId = bc.bookId
       JOIN books b ON cb.bookId = b.id
       JOIN questions q ON bc.chapterId = q.chapterId
       WHERE collections.id = ?
       GROUP BY b.id
       `,
     [collectionId]
    )).map(({bookId, threshold}) => [bookId, threshold])
  );

export type CollectionStats = {
  answered: number;
  correct: number;
  wrong: number;
  nQuestions: number;
  threshold: number | null;
}

export const getUserCollectionStats =
  async (accessToken: string, collectionId: number
): Promise<Record<number, CollectionStats> | null>  => {
  const userId = await getUserId(accessToken);
  if (!userId) {
    return null;
  }
  return Object.fromEntries(
    (await db.all(
      `SELECT
         books.id as bookId,
         SUM(CASE WHEN ans.id IS NOT NULL THEN 1 ELSE 0 END) AS answered,
         COALESCE(SUM(ans.isCorrect),0) AS correct,
         COALESCE(SUM(1 - ans.isCorrect),0) AS wrong,
         books.quizThreshold AS threshold,
         COUNT(q.id) AS nQuestions
       FROM collections_books cb
         JOIN books ON cb.bookId = books.id
         JOIN books_chapters bc ON books.id = bc.bookId
         JOIN questions q ON bc.chapterId = q.chapterId
         LEFT JOIN (
           SELECT a.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY a.questionId
                    ORDER BY a.createdAt DESC
                  ) AS rn
           FROM answers a
           WHERE a.userId = ?
       ) ans ON books.id = ans.bookId AND ans.questionId = q.id
       WHERE COALESCE(rn,1) = 1 AND cb.collectionId = ?
       GROUP BY books.id;
    `, [userId, collectionId] as (CollectionStats & {bookId: number})[]))
    .map(({bookId, ...rest}) => [bookId, rest] as [number, Omit<CollectionStats, "bookId">])
  );
}
