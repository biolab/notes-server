import sqlite3 from "sqlite3";
import path from "node:path";
import { open } from "sqlite";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

const db = await open({
  filename: path.join(DB_FILE),
  driver: sqlite3.Database,
});
await db.exec("PRAGMA foreign_keys = ON");

export default db;
