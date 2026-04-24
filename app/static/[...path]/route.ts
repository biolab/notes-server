import fs from "fs/promises";
import path from "path";
import mime from 'mime';

import { NextRequest, NextResponse } from "next/server";

import { CONFIG } from "@/utils/config";

// Notes static files take precedence over Next.js public files.
// In production, static files are copied, e.g. to /var/www/<name>;
// while in development they are served from the repository.
// This location is thus defined by CONFIG.staticPath (in production),
// and defaults to CONFIG.notesPath (for development).
const notesStaticDir = CONFIG.staticPath || CONFIG.notesPath;
const nextPublicDir = path.posix.join(process.cwd(), "public");

const tryServe = async (base: string, segments: string[]) => {
  const filePath = path.posix.join(base, ...segments);
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
    await tryServe(notesStaticDir, segments)
    || await tryServe(nextPublicDir, segments);
  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mimeType = mime.getType(segments[segments.length - 1]) || "application/octet-stream";
  return new NextResponse(
    new Blob([new Uint8Array(content)]),
    { headers: { "Content-Type": mimeType } }
  );
}
