import sqlite3 from "sqlite3";
import path from "path";
import { getMdFile, setBasePath } from "../utils/helpers";
import { getPaths } from "../utils/getPaths";
import { open } from "sqlite";
import {updatePaths} from "@/utils/updatePaths";
import { program } from "commander";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

async function updateDb(pathPrefix: string, update: false) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });

  let buildId, prefix;
  if (update) {
    buildId = (await db.get(`SELECT MAX(id) as buildId FROM builds;`)).buildId;
    prefix = (await db.get(`SELECT path FROM builds WHERE id = ?;`, [buildId.buildId])).path;
  }
  else {
    buildId = (await db.get(`INSERT INTO builds (path) VALUES (?) RETURNING id;`, [pathPrefix])).id;
    prefix = pathPrefix;
  }

  const paths: [string[], boolean][] = getPaths(prefix ? prefix.split("/") : []).map((path) => [path, !!getMdFile(path)]);
  const bookPaths = paths.filter(([, isBook]) => isBook).map(([path]) => path);
  const collectionPaths = paths.filter(([, isBook]) => !isBook).map(([path]) => path);
  await updatePaths(bookPaths, collectionPaths, db, buildId, prefix);
}

program
  .option("-p, --path <path>", "Path to the directory to update", "")
  .option("-u, --update", "Update without increasing the build number", false)
  .option("-b, --base <path>", "Base path for libraries");

program.parseOptions(process.argv.slice(2));
const { path: pathPrefix, update, base } = program.opts();
if (pathPrefix && update) {
  console.error("Both --path and --update options are provided. Please provide only one.");
  process.exit(1);
}
if (base) {
  setBasePath(base);
}

updateDb(pathPrefix, update).catch((err) => {
  console.error("Error making a new build:", err);
  process.exit(1);
});
