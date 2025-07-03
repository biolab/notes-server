import path from "node:path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export const userCreate = async ({ email }: { email: string }) => {
  const db = await open({
    filename: path.join(DB_FILE),
    driver: sqlite3.Database,
  });

  const user = await db.get(
    `INSERT INTO users (email, access_token) VALUES (?, ?)`,
    [email, "test_token"]
  );

  return user;
};
