import { NextResponse } from "next/server";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
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
    if (totalSize > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload failed: total file size if too large" }, { status: 500 });
    }
    const {dir, error} = await getUploadDir({accessToken, bookId, groupId, qId});
    if (!dir || error) { // both will be true; this is to satisfy TS later on
      return NextResponse.json({ error: `Upload failed: ${error}` },{ status: 500 });
    }
    if (existsSync(dir)) {
      rmSync(dir, { force: true, recursive: true });
    }
    mkdirSync(dir, { recursive: true });

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.join(dir, file.name);
      writeFileSync(filePath, buffer);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
