import path from "path";
import fs from "fs";

const maybeNotesPath = !process.env.CI ? process.env.NEXT_NOTES_PATH : "/tmp/notes";
if (!maybeNotesPath) {
  throw new Error("Set NEXT_NOTES_PATH (e.g. /Users/janez/notes) in .env")
}

let notesPath = maybeNotesPath.replace(/\/$/, "");

export const setNotesPath = (newPath: string) => {
  notesPath = newPath.replace(/\/$/, "");
}

export const getNotesPath = () => notesPath;

export const joinedPath = (spath: string | string[]) =>
  path.join(notesPath, ...(typeof spath === "string" ? [spath] : spath));

export const pathExists = (...spath: string[]) =>
  fs.existsSync(joinedPath(spath));

export const isDirectory = (...spath: string[]) =>
  fs.statSync(joinedPath(spath), {throwIfNoEntry: false})?.isDirectory();

export const readPublicDir = (...spath: string[]): string[] =>
  fs.readdirSync(joinedPath(spath));