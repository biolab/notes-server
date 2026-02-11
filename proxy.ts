import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!(pathname.startsWith("/api")
        || pathname.startsWith("/_next"))
     && /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = `/static${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
