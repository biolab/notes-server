import path from "path";
import fs from "fs";
import { CONFIG } from "@/utils/config";

export const joinedPath = (spath: string | string[]) =>
  path.posix.join(CONFIG.notesPath, ...(typeof spath === "string" ? [spath] : spath));

export const pathExists = (...spath: string[]) =>
  fs.existsSync(joinedPath(spath));

export const isDirectory = (...spath: string[]) =>
  fs.statSync(joinedPath(spath), {throwIfNoEntry: false})?.isDirectory();

export const readPublicDir = (...spath: string[]): string[] =>
  fs.readdirSync(joinedPath(spath));

export const readFile = (...spath: string[]): string =>
  fs.readFileSync(joinedPath(spath), "utf-8");
