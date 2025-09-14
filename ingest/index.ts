import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { getPaths } from "./md-helpers";
import { updatePaths } from "./updatePaths";
import { getFaviconPaths } from "./favicons";


export const DB_PATH = path.join(process.cwd(), "db");
export const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export async function updateDb(pathPrefix: string, update=false, check=false) {
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

  const paths: [string[], boolean][] = getPaths(prefix ? [prefix] : []);
  const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
  const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
  const faviconPaths = getFaviconPaths(prefix);
  await updatePaths(bookPaths, collectionPaths, faviconPaths, db, buildId, prefix);
}
