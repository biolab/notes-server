import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { setBasePath } from "@/ingest/paths";
import { getPaths } from "@/ingest/md-helpers";
import { updatePaths } from "@/ingest/updatePaths";

export const DB_PATH = path.join(process.cwd(), "db");
export const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export async function updateDb(basePath: string, pathPrefix: string, update=false) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });
  if (basePath) {
    setBasePath(basePath);
  }

  let buildId, prefix;
  if (update) {
    buildId = (await db.get(`SELECT MAX(id) as buildId FROM builds;`)).buildId;
    prefix = (await db.get(`SELECT path
                            FROM builds
                            WHERE id = ?;`, [buildId.buildId])).path;
  } else {
    buildId = (await db.get(`INSERT INTO builds (path)
                             VALUES (?)
                             RETURNING id;`, [pathPrefix])).id;
    prefix = pathPrefix;
  }

  const paths: [string[], boolean][] = getPaths(prefix ? prefix.split("/") : []);
  const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
  const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
  await updatePaths(bookPaths, collectionPaths, db, buildId, prefix);
}
