import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { getBookSlug, getGroupName } from "@/api/book";
import { getQuestionIdFromId } from "@/api/quiz";

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

export const hash24 = (s: string) =>
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

  return {dir: path.join(process.cwd(),
    "uploads",
    ...[bookSlug, group || "no-group", questionId].map(hash24),
    accessToken)};
}
