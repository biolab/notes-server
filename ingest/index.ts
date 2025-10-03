import { readFileSync } from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { load } from "js-yaml";

import { getPaths } from "./md-helpers";
import { updatePaths } from "./updatePaths";
import { getFaviconPaths } from "./favicons";


export const DB_PATH = path.join(process.cwd(), "db");
export const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export async function updateDb(
  pathPrefix: string,
  update=false,
  check=false,
  exceptionsFile: string | null = null) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA foreign_keys = ON");

  const buildId =
    check ? null
    : update ? (await db.get(`SELECT MAX(id) as id FROM builds;`)).id
    : (await db.get(`INSERT INTO builds (path) VALUES (?) RETURNING id`, [pathPrefix])).id;

  const prefix =
    update ? (await db.get(`SELECT path FROM builds WHERE id = ?;`, [buildId])).path
    : pathPrefix;

  let moved: [string, string][] = [];
  let relaxed: string[] = [];
  if (exceptionsFile) {
    const exceptions = load(readFileSync(exceptionsFile, 'utf-8')) as {
      moved?: {[from: string]: string},
      relaxed?: string[],
      prefix?: string
    };
    if (exceptions.moved && typeof exceptions.moved !== "object") {
      if (Array.isArray(exceptions.moved)) {
        throw new Error("Exceptions file must be a mapping, not a list (no leading dashes!)");
      }
      throw new Error("Exceptions file must be a mapping");
    }
    const p = exceptions.prefix
      ? (s: string) => `${exceptions.prefix}/${s.replace(/^\//, "")}`
      : (s: string) => s;
    moved = Object.entries(exceptions.moved || {})
        .map(([from, to]) => [p(from), p(to)]);
    relaxed = (exceptions.relaxed || []).map(p);
  }

  const paths: [string[], boolean][] = getPaths(prefix ? [prefix] : []);
  const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
  const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
  const faviconPaths = getFaviconPaths(prefix);
  await updatePaths(bookPaths, collectionPaths, faviconPaths, db, buildId, prefix, moved, relaxed);
}
