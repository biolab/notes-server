import { readFileSync } from "fs";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { getUserFilesInBook } from "@/api/quiz";
import { zipResponse } from "@/utils/zip";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const bookId = parseInt(url.searchParams.get("bookId") || "-1");
  const groupId = url.searchParams.get("groupId");
  const accessToken = url.searchParams.get("accessToken") || "";
  const userId = url.searchParams.get("userId") || "-1";
  const questionId = url.searchParams.get("questionId");
  const fileName = url.searchParams.get("fileName") || "uploaded-files.zip";

  const answerFiles = await getUserFilesInBook({
    bookId, userId, accessToken,
    groupId: groupId ? parseInt(groupId) : null,
    questionId: questionId ? parseInt(questionId) : null,
  });

  if (!answerFiles || answerFiles.length === 0) {
    return new Response("Not found", {status: 404});
  }

  const readFile = (
    bookId: number, aGroupId: number, qId: number, uAccessToken: string,
    fileName: string
  ) =>
    readFileSync(`uploads/${bookId}/${aGroupId ? `${aGroupId}` : "no-group"}/${qId}/${uAccessToken}/${fileName}`);

  if (answerFiles.length === 1 && answerFiles[0].fileNames.length === 1) {
    const { groupId: aGroupId, qId, accessToken, fileNames } = answerFiles[0];
    return new Response(readFile(bookId, aGroupId, qId, accessToken, fileNames[0]))
  }
  const zip = new JSZip();
  answerFiles.forEach(({questionId, group, groupId: aGroupId, accessToken: uAccessToken, qId, fileNames}) => {
    fileNames.forEach((fileName) => {
      const data = readFileSync(`uploads/${bookId}/${aGroupId ? `${aGroupId}` : "no-group"}/${qId}/${uAccessToken}/${fileName}`);
      const path = `${groupId ? `${group}/` : ""}${questionId}/${fileName}`;
      zip.file(path, data, {binary: true});
    });
  });

  return await zipResponse(zip, fileName);
}
