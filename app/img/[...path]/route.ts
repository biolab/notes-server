import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const IMAGE_EXTS = [".png", ".gif", ".jpg"]

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const appRoot = process.cwd();
  const filePath = path.join(appRoot, url.pathname.slice(4)); // remove "/img"
  const ext = path.extname(filePath).toLowerCase().replace("jpg", "jpeg");
  if (!filePath.startsWith(path.join(appRoot, "notes") + path.sep)
      || !IMAGE_EXTS.includes(ext)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = `image/${ext}`;
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
