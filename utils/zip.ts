"use server";

import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { getBookSlug, getGroupName } from "@/api/book";
import { getPostAnswerData, getQuestionIdFromId } from "@/api/quiz";
import { CONFIG } from "@/utils/config";
import fs from "fs";
import db from "@/utils/db";

export const zipResponse = async (zip: JSZip, fileName: string) => {
  const zipBuffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.generateNodeStream({type: "nodebuffer", streamFiles: true})
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
  const zipFilename = encodeURIComponent(fileName);
  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/zip',
      'Content-Disposition':
        `attachment; filename="${zipFilename}"`,
    },
  });
}

const hash24 = (s: string) =>
  crypto.createHash("sha256").update(s).digest("base64url").slice(0, 24);

export const getUploadDir = async ({bookId, groupId, qId, accessToken}: {
  bookId: string | number | null,
  groupId?: string | number | null,
  qId: string | number | null,
  accessToken: string | null
}): Promise<{ dir?: string, error?: string}> => {
  if (!accessToken) {
    return {error: "invalid accessToken"};
  }
  const bookSlug = bookId && await getBookSlug(Number(bookId));
  if (!bookSlug) {
    return {error: "invalid bookId"};
  }
  const questionId = qId && await getQuestionIdFromId(Number(qId));
  if (!questionId) {
    return {error: "invalid questionId"};
  }
  const group = groupId ? (await getGroupName(Number(groupId))) : null;
  if (groupId && !group) {
    return {error: "invalid groupId"};
  }

  return {dir: path.resolve(
    /* turbopackIgnore: true */ CONFIG.uploadsPath,
    ...[bookSlug, group || "no-group", questionId].map(hash24),
    accessToken)};
}

export const removeFile = async (
  file: string | undefined,
  {bookId, groupId, questionId, accessToken}: {
    bookId: number,
    groupId: number | null,
    questionId: string,
    accessToken: string}) => {
  let qData: Awaited<ReturnType<typeof getPostAnswerData>>;
  try { qData = await getPostAnswerData({accessToken, group: groupId, bookId, questionId}); }
  catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error)};
  }
  const {question, lastAttemptId} = qData;
  if (!question.type.startsWith("upload")) {
    return { status: "error", message: "Question is not of upload type" };
  }
  if (!lastAttemptId) {
    return { status: "error", message: "No answer attempt found for this question" };
  }
  const {dir, error} = await getUploadDir({bookId, groupId, qId: question.id!, accessToken});
  if (error) {
    return { status: "error", message: error};
  }

  if (!file) {
    // Remove whole directory
    await fs.promises.rm(dir!, {force: true, recursive: true});
    await db.run(`DELETE FROM uploads WHERE answerId = ?`, [lastAttemptId]);
  }
  else {
    try {
      const safeFile = path.basename(file);
      await fs.promises.rm(path.join(/* turbopackIgnore: true */ dir!, safeFile), {force: true});
      await db.run(`DELETE FROM uploads WHERE answerId = ? AND filename = ?`, [lastAttemptId, safeFile]);
    }
    catch (err) {
      return { status: "error", message: `Failed to remove file ${file}: ${err instanceof Error ? err.message : String(err)}`};
    }
  }
  return null;
}
