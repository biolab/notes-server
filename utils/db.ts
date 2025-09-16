import sqlite3 from "sqlite3";
import path from "node:path";
import { open, Database } from "sqlite";

let db: Database;

if (!process.env.CI) {
  const DB_PATH = path.join(process.cwd(), "db");
  const DB_FILE = path.join(DB_PATH, "notes.sqlite");

  db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  await db.exec("PRAGMA foreign_keys = ON");
} else {
  db = {} as unknown as Database;
}

export default db;
