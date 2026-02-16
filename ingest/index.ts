import { readFileSync, statSync } from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { Database } from "sqlite";
import { open } from "sqlite";
import { load } from "js-yaml";
import { Mutex } from 'async-mutex';
import chokidar from "chokidar";

import { getPaths } from "./md-helpers";
import { updatePaths, updateRoot } from "./updatePaths";
import { getInheritableResources } from "./inheritables";
import { getLoginMails } from "@/ingest/mail";
import { joinedPath, readPublicDir } from "@/ingest/paths";
import { broadcastReload, getDevWebSocketServer } from "@/ingest/devWebSocket";

export const DB_PATH = path.join(process.cwd(), "db");
export const DB_FILE = path.join(DB_PATH, "notes.sqlite");

const updateMutex = new Mutex();

const watchForChanges = (
  path: string,
  doUpdate: () => Promise<boolean>,
) => {
  let pending = false;

  const triggerUpdate = async () => {
    if (updateMutex.isLocked()) {
      pending = true;
      return;
    }

    await updateMutex.runExclusive(async () => {
      do {
        pending = false;
        await doUpdate();
        broadcastReload();
      } while (pending);
    });
  };

  console.log(`Waiting for changes in ${path}...`);
  chokidar.watch(path, {
    persistent: true,
    ignoreInitial: true,
  }).on('all', triggerUpdate);
}

export async function updateDb(
  prefix: string,
  check=false,
  exceptionsFile: string | null = null,
  force=false,
  dev=false
) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA foreign_keys = ON");
  let anyErrors = false;

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
    let prevBuild = new Date(process.env.NEXT_PUBLIC_DEVELOPMENT && !force &&
      (await db.get(
        `SELECT MAX(timestamp) as time, path FROM builds WHERE path = ?`,
        [prefix])
      )?.time
      || 0);
    const buildId = check ? null : (await db.get(
      `INSERT INTO builds (path, timestamp) VALUES (?, ?) RETURNING id`,
      [prefix, "1970-01-01"])).id;

    const paths: [string[], boolean][] = getPaths([prefix]);
    if (paths.length === 0) {
      continue;
    }

    const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
    const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
    const resourcePaths = getInheritableResources(prefix);
    const mailPaths = getLoginMails(prefix);

    const doUpdate = async () => {
      const res = await updatePaths(bookPaths, collectionPaths, resourcePaths, mailPaths, db, buildId, prevBuild, prefix, moved, relaxed);
      if (res) {
        prevBuild = new Date();
      }
      return res;
    }

    anyErrors = anyErrors || !
      await doUpdate();

    if (dev) {
      getDevWebSocketServer();
      watchForChanges(joinedPath(prefix), doUpdate);
    }
  }

  if (!prefix && !check) {
    await updateRoot(db);
  }

  if (anyErrors) {
    process.exit(1);
  }
}
