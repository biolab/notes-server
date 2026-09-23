import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CONFIG } from "@/utils/config";
import path from "path";
import fs from "node:fs/promises";

const notesStaticDir = CONFIG.staticPath || CONFIG.notesPath;
const nextPublicDir = path.posix.join(process.cwd(), "public");

const existsAsFile = async (base: string, pathname: string) => {
  const filePath = path.join(base, pathname.slice(1)); // remove /
  // Prevent escaping escaping base via ..
  const relative = path.relative(base, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api") &&
      !pathname.startsWith("/_next") &&
      /[^/]+\.[^/]+$/.test(pathname) && (
        await existsAsFile(notesStaticDir, pathname) ||
        await existsAsFile(nextPublicDir, pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = `/static${pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}
