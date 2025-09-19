import fs from "fs/promises";
import path from "path";
import mime from 'mime';

import { NextRequest, NextResponse } from "next/server";

import { getNotesPath } from "@/ingest/paths";


const publicDir = path.join(process.cwd(), "public");

const tryServe = async (base: string, segments: string[]) => {
  const filePath = path.join(base, ...segments);
  if (!filePath.startsWith(base + path.sep)) {
    return null;
    // Keep them in the dark
    // throw new Error("Path traversal attempt");
  }
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;

  const content =
    await tryServe(getNotesPath(), segments)
    || await tryServe(publicDir, segments);
  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mimeType = mime.getType(segments[segments.length - 1]);
  if (!mimeType) {
    return NextResponse.json({ error: "Unknown mime type" }, { status: 415 });
  }
  return new NextResponse(
    new Blob([new Uint8Array(content)]),
    { headers: { "Content-Type": mimeType } }
  );
}
