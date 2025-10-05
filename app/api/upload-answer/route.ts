import { NextResponse } from "next/server";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { getUser } from "@/api/user";
import { idFromQuestionId } from "@/api/quiz";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const questionId = formData.get("questionId") as string | null;
    const accessToken = formData.get("accessToken") as string | null;
    const bookId = formData.get("bookId") as string | null;
    const group = formData.get("group") as string | null;

    // This is checked on the front-end, but let us prevent some joker
    // from calling this manually
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload failed: total file size if too large" }, { status: 500 });
    }
    if (!accessToken || !await(getUser(accessToken))) {
      return NextResponse.json({ error: "Upload failed: invalid accessToken" }, { status: 500 });
    }
    let qId: number | undefined;
    try {
      qId = await idFromQuestionId(Number(bookId || "-1"), questionId || "")
    }
    catch {
      return NextResponse.json({ error: "Upload failed: invalid bookId or questionId" }, { status: 500 });
    }
    const uploadDir = path.join(
      process.cwd(), "uploads", bookId!, group || ".", `${qId}`, accessToken);

    if (existsSync(uploadDir)) {
      rmSync(uploadDir, { force: true, recursive: true });
    }
    mkdirSync(uploadDir, { recursive: true });

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.join(uploadDir, file.name);
      writeFileSync(filePath, buffer);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
