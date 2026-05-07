/* This is not TypeScript because it has await at top-level => must be imported with dynamic import by ingest */

import path from "node:path";
import fs from "fs";
import { fileURLToPath } from "node:url";

export const migrate = async (db) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const migrationsDir = path.resolve(dirname, "db-migrations");

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found at ${migrationsDir}`);
    return;
  }
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const { user_version } = await db.get(`PRAGMA user_version`);
  for (const file of migrationFiles) {
    const version = parseInt(file.split("-")[0]);
    if (version > user_version) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await db.exec("BEGIN TRANSACTION");
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${version}`);
      await db.exec("COMMIT");
      console.log("Applied migration:", file);
    }
  }
}
