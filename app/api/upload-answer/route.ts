import path from "path";
import fs, { mkdirSync, writeFileSync } from "fs";
import { NextResponse } from "next/server";
import { getUploadDir } from "@/utils/zip";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const accessToken = formData.get("accessToken") as string | null;
    const bookId = formData.get("bookId") as string | null;
    const groupId = formData.get("groupId") as string | null;
    const qId = formData.get("qId") as string | null;

    // This is checked on the front-end, but let us prevent jokers
    // from calling this manually and uploading huge files
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Upload failed: total file size is too large" },
        { status: 500 });
    }
    const {dir, error} = await getUploadDir({accessToken, bookId, groupId, qId});
    if (!dir || error) { // both will be true; this is to satisfy TS later on
      return NextResponse.json(
        { error: `Upload failed: ${error}` },
        { status: 500 });
    }

    mkdirSync(dir, { recursive: true });

    const existingSize = fs.readdirSync(dir).reduce((acc, file) => {
      const stats = fs.statSync(path.join(dir, file));
      return acc + stats.size;
    }, 0);
    if (existingSize + totalSize > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Upload failed: total file size exceeds limit" },
        { status: 500 });
    }

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.posix.join(dir, file.name);
      writeFileSync(filePath, buffer);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
