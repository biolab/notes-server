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

const tryPath = async (base: string, segments: string[]) => {
  const filePath = path.posix.join(base, ...segments);
  if (!filePath.startsWith(base + path.sep)) {
    return null;
  }
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;

  const filePath =
    (await tryPath(notesStaticDir, segments)) ??
    (await tryPath(nextPublicDir, segments));

  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = await fs.stat(filePath);
  const size = stat.size;
  const mimeType =
    mime.getType(segments[segments.length - 1]) ||
    "application/octet-stream";

  const range = request.headers.get("range");
  if (!range) {
    return new NextResponse(await fs.readFile(filePath), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": size.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    // bytes=-N
    const length = Number(match[2]);
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (start >= size || start > end) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  end = Math.min(end, size - 1);
  const length = end - start + 1;
  const handle = await fs.open(filePath, "r");
  const buffer = Buffer.alloc(length);
  try {
    await handle.read(buffer, 0, length, start);
  } finally {
    await handle.close();
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 206,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": length.toString(),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
