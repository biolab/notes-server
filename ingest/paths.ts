import path from "path";
import fs from "fs";

export let basePath = "public";
export const setBasePath = (base: string) => {
  basePath = base;
}
export const joinedPath = (spath: string | string[]) =>
  path.join(basePath, ...(typeof spath === "string" ? [spath] : spath));

export const pathExists = (...spath: string[]) =>
  fs.existsSync(joinedPath(spath));

export const isDirectory = (...spath: string[]) =>
  fs.statSync(joinedPath(spath), {throwIfNoEntry: false})?.isDirectory();

export const readPublicDir = (...spath: string[]): string[] =>
  fs.readdirSync(joinedPath(spath));