import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { NextResponse } from "next/server";
import { getUploadDir } from "@/utils/zip";
import db from "@/utils/db";
import { getUser } from "@/api/user";

const MAX_PER_QUESTION = 50 * 1024 * 1024;
const MAX_PER_USER = 200 * 1024 * 1024;
const MAX_PER_ANON_USER = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const accessToken = formData.get("accessToken") as string | null;
    const bookId = formData.get("bookId") as string | null;
    const groupId = formData.get("groupId") as string | null;
    const qId = formData.get("qId") as string | null;

    const error = (message: string) => NextResponse.json({ error: message }, { status: 500 });

    const user = await getUser(accessToken!);
    if (!user)
      return error("invalid access token");
    const userId = user.id;

    const answerId = (await db.get(`
      SELECT id FROM answers
      WHERE userId = ? AND questionId = ? AND groupId IS ? AND bookId = ?`,
      [userId, qId, groupId, bookId]))?.id;
    if (!answerId)
      return error("answer not found");

    if (file.size > 10 * 1024 * 1024)
      return error("individual file size exceeds limit");

    const fileName = path.basename(file.name); // sanitize filename
    if (fileName.includes("\n"))
      return error("invalid file name");

    const uploadedThisAnswer = (await db.get(`
      SELECT SUM(size) as total FROM uploads WHERE answerId = ?`, [answerId])
    )?.total || 0;
    if (file.size + uploadedThisAnswer > MAX_PER_QUESTION)
      return error("total file size for this question exceeds limit");

    const uploadedThisUser: number = (await db.get(`
      SELECT SUM(size) as total FROM uploads JOIN answers a ON a.id = uploads.answerId WHERE a.userId = ?`, [userId])
    )?.total || 0;
    if (uploadedThisUser + file.size > (user.name ? MAX_PER_USER : MAX_PER_ANON_USER))
      return error("total file size for this user exceeds limit");

    const {dir, error: message} = await getUploadDir({accessToken, bookId, groupId, qId});
    if (message)
      return error(message);
    if (!dir)
      return error("could not determine upload directory");

    mkdirSync(dir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.posix.join(dir, fileName);
    writeFileSync(filePath, buffer);

    await db.run(
      `INSERT INTO uploads (answerId, filename, size) VALUES (?, ?, ?)
       ON CONFLICT (answerId, filename) DO
           UPDATE SET size = excluded.size, createdAt = CURRENT_TIMESTAMP
      `,
      [answerId, fileName, file.size]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
