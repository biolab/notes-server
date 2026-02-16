import sqlite3 from "sqlite3";
import path from "node:path";
import { open, Database } from "sqlite";
import { CONFIG } from "@/utils/config";

let db: Database;

if (!process.env.CI) {
  db = await open({
    filename: path.resolve(CONFIG.dbPath, "notes.sqlite"),
    driver: sqlite3.Database,
  });

  await db.exec("PRAGMA foreign_keys = ON");
} else {
  db = {} as unknown as Database;
}

export default db;
