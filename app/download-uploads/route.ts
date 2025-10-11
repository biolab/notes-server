import { readFileSync } from "fs";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { getUserFilesInBook } from "@/api/quiz";
import { getUploadDir, zipResponse } from "@/utils/zip";
import mime from "mime-types";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const bookId = url.searchParams.get("bookId");
  const groupId = url.searchParams.get("groupId");
  const accessToken = url.searchParams.get("accessToken") || "";
  const userId = url.searchParams.get("userId") || "-1";
  const qId = url.searchParams.get("qId");
  const fileName = url.searchParams.get("fileName") || "uploaded-files.zip";

  const answerFiles = await getUserFilesInBook({
    bookId: parseInt(bookId || "-1"),
    qId: qId ? parseInt(qId) : null,
    groupId: groupId ? parseInt(groupId) : null,
    userId, accessToken,
  });

  if (!answerFiles || answerFiles.length === 0) {
    return new Response("Not found", {status: 404});
  }

  if (answerFiles.length === 1 && answerFiles[0].fileNames.length === 1) {
    const { groupId, qId, accessToken, fileNames } = answerFiles[0];
    const { dir, error} = await getUploadDir({bookId, groupId, qId, accessToken});
    if (error || !dir) {
      return NextResponse.json({ error }, { status: 500 });
    }
    const fileName = fileNames[0];
    const contentType = mime.lookup(fileName) || "application/octet-stream";
    const fileBuffer = readFileSync(`${dir}/${fileName}`);
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }
  const zip = new JSZip();
  for(const {questionId, group, fileNames, ...dirParts} of answerFiles) {
    const { dir, error } = await getUploadDir({bookId, ...dirParts});
    if (error || !dir) {
      return NextResponse.json({ error }, { status: 500 });
    }
    fileNames.forEach((fileName) => {
      const data = readFileSync(`${dir}/${fileName}`);
      const path = `${groupId ? `${group}/` : ""}${questionId}/${fileName}`;
      zip.file(path, data, {binary: true});
    });
  }
  return await zipResponse(zip, fileName);
}
