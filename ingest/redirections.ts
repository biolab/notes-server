import { Database } from "sqlite";
import { load } from "js-yaml"
import { readFileSync } from "fs";
import { join } from "path";

import { isDirectory, joinedPath, pathExists, readPublicDir } from "./paths";
import { logError } from "./errors";


export const gatherRedirections = (prefix: string): [string, string][] => {
  if (!prefix) {
    return readPublicDir()
      .filter((dir) => isDirectory(dir))
      .flatMap((dir) => gatherRedirections(dir));
  }
  if (!pathExists(prefix, "redirections.yml")) {
    return [];
  }

  let redirs;
  try {
    redirs = load(readFileSync(joinedPath([prefix, "redirections.yml"]), "utf8"));
  }
  catch (e) {
    logError(prefix, "Invalid redirections.yml");
    return [];
  }
  if (!redirs) {
    return [];
  }
  if (typeof redirs !== "object"
    || Object.values(redirs).some((v) => typeof v !== "string")) {
    logError(prefix, "Invalid redirections.yml");
    return [];
  }

  return Object.entries(redirs as Record<string, string>)
      .map(([path, target]) => [
        join(prefix, path),
        target.startsWith("//") ? target.slice(1) : "/" + join(prefix, target)
      ]);
}

let warnedAboutRedirections = false;
const warnRedirections = () => {
  if (!warnedAboutRedirections) {
    console.log(
      "Server did not accept updated redirections (on port 3020); " +
      "if it is not running, this is normal and harmless."
    );
    warnedAboutRedirections = true;
  }
}

export const updateRedirections = async (
  db: Database,
  buildId: number | null,
  pathPrefix: string,
  redirections: [string, string][] = []
) => {
  if (pathPrefix) {
    await db.run("DELETE FROM redirections WHERE path = ? OR PATH LIKE ?",
      [pathPrefix, pathPrefix + "/%"]);
  }
  else {
    await db.run("DELETE FROM redirections");
  }

  redirections.forEach(([path, target]) => {
    db.run(`
      INSERT INTO redirections (path, target, lastBuildId)
      VALUES (?, ?, ?)
    `, path, target, buildId);
  });

  try {
    const res = await fetch("http://localhost:3020/api/updateRedirections");
    if (!res.ok) {
      warnRedirections();
    }
  }
  catch {
    warnRedirections();
  }
}
