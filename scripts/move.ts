import path from "path";
import { CONFIG } from "@/utils/config";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

if (process.argv.length != 4) {
  console.error("Usage: node move-book.js <from> <to>");
  process.exit(1);
}

const [, , from, to] = process.argv;
let updated = false;

open({
  filename: path.resolve(CONFIG.dbPath, "notes.sqlite"),
  driver: sqlite3.Database,
}).then(async (db) => {
  for (const table of ["books", "collections", "chapters", "inheritables"]) {
    const result = await db.run(
      `UPDATE ${table}
       SET path = ? || substr(path, ?)
       WHERE path LIKE ?`,
      [to, from.length + 1, from + "/%"]);
    if (result.changes) {
      console.log(`Updated ${result.changes} entries in table "${table}".`);
      updated = true;
    }
  }
  if (!updated) {
    console.log(`No entries found with path starting with "${from}".`);
  }
});
