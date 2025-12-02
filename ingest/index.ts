import { readFileSync, statSync } from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { load } from "js-yaml";
import chokidar from "chokidar";

import { getPaths } from "./md-helpers";
import { updatePaths } from "./updatePaths";
import { getFaviconPaths } from "./favicons";
import { getLoginMails } from "@/ingest/mail";
import { joinedPath, readPublicDir } from "@/ingest/paths";


export const DB_PATH = path.join(process.cwd(), "db");
export const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export async function updateDb(
  prefix: string,
  check=false,
  exceptionsFile: string | null = null,
  dev=false
) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA foreign_keys = ON");

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

  const prefixes = prefix ? [prefix]
    : readPublicDir()
      .filter((entry) => statSync(joinedPath(entry)).isDirectory());
  for(const prefix of prefixes) {
    let prevBuild = new Date(process.env.DEVELOPMENT &&
      (await db.get(
        `SELECT MAX(timestamp) as time, path FROM builds WHERE path = ?`,
        [prefix])
      )?.time
      || 0);
    const buildId =
      check ? null
      : (await db.get(
          `INSERT INTO builds (path) VALUES (?) RETURNING id`,
          [prefix])).id;

    const paths: [string[], boolean][] = getPaths([prefix]);
    if (paths.length === 0) {
      continue;
    }

    const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
    const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
    const faviconPaths = getFaviconPaths(prefix);
    const mailPaths = getLoginMails(prefix);

    const doUpdate = async () => {
      await updatePaths(bookPaths, collectionPaths, faviconPaths, mailPaths, db, buildId, prevBuild, prefix, moved, relaxed);
      prevBuild = new Date();
    }

    await doUpdate();

    if (dev) {
      const path = joinedPath(prefix);
      console.log(`Waiting for changes in ${path}...`);
      chokidar.watch(joinedPath(prefix), {
        persistent: true,
        ignoreInitial: true,
      }).on('all', async () => {
        console.log(`${path} changed.`);
        await doUpdate();
        await db.run("UPDATE builds SET timestamp = CURRENT_TIMESTAMP WHERE id = ?", [buildId]);
      });
    }
  }
}
