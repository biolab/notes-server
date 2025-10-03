'use server'

import { loadRedirections } from "@/utils/redirections";
import { NextResponse } from "next/server";

export async function GET() {
  await loadRedirections();
  return NextResponse.json({ message: "OK" }, { status: 200 });
}
