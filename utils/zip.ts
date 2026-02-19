"use server";

import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { getBookSlug, getGroupName } from "@/api/book";
import {getQId, getQuestionIdFromId} from "@/api/quiz";
import { CONFIG } from "@/utils/config";
import fs from "fs";

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
    CONFIG.uploadsPath,
    ...[bookSlug, group || "no-group", questionId].map(hash24),
    accessToken)};
}

export const removeFiles = async (
  files: string[] | true,
  {bookId, groupId, questionId, accessToken}: {
    bookId: number,
    groupId: number | null,
    questionId: string,
    accessToken: string}) => {
  const qId = await getQId(bookId, questionId);
  const {dir, error} = await getUploadDir({bookId, groupId, qId, accessToken});
  if (error) {
    return error;
  }
  if (files === true) {
    // Remove whole directory
    try {
      await fs.promises.rm(dir!, {force: true, recursive: true});
    }
    catch (err) {
      return `Failed to remove directory: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  else {
    const errors = [];
    for (const file of files) {
      try {
        const safeFile = path.basename(file);
        await fs.promises.rm(path.join(dir!, safeFile), {force: true});
      }
      catch (err) {
        const errorMessage = `Failed to remove file ${file}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }
    if (errors.length) {
      return errors.join("; ");
    }
  }
  return null;
}
