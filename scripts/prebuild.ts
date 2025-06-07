import sqlite3 from "sqlite3";
import path from "path";
import { getMdFile } from "../utils/helpers";
import { getBookProps } from "../utils/getBookProps";
import { getCollectionProps } from "../utils/getCollectionProps";
import { getPaths } from "../utils/getPaths";
import { open } from "sqlite";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

async function prebuild(trigger: string) {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });
  const { id: buildId } = await db.get(`INSERT INTO builds (trigger)
                                        VALUES (?)
                                        RETURNING id;`, [trigger]);

  await Promise.all(
    getPaths([]).map(async (path) =>
      getMdFile(path)
        ? await getBookProps(path, db, buildId)
        : await getCollectionProps(path, db, buildId),
    ),
  );
}

const trigger = process.argv[2] || "manual";

prebuild(trigger).catch((err) => {
  console.error("Error marking a new build:", err);
  process.exit(1);
});
