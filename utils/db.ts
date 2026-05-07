import sqlite3 from "sqlite3";
import path from "node:path";
import { open, Database } from "sqlite";
import { CONFIG } from "@/utils/config";
import { migrate } from "@/utils/migrateDb.mjs";

let db: Database;

if (!(process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI)) {
  db = await open({
    filename: path.resolve(CONFIG.dbPath, "notes.sqlite"),
    driver: sqlite3.Database,
  });

  if (process.env.NODE_ENV === "development" && !(db as any)._isPatched) {
    const methods = ["get", "all", "run"] as const;

    methods.forEach((method) => {
      // We cast to any here to allow the override
      const original = (db as any)[method].bind(db);

      (db as any)[method] = async (sql: string, ...params: any[]) => {
        try {
          return await original(sql, ...params);
        } catch (err: any) {
          console.group(`🚨 SQLITE_ERROR in db.${method}()`);
          console.error(`Query:`, sql);
          console.error(`Params:`, params);
          console.error(`Message:`, err.message);
          console.groupEnd();
          throw err;
        }
      };
    });

    (db as any)._isPatched = true;
  }

  await db.exec("PRAGMA foreign_keys = ON");
  await migrate(db);
} else {
  db = {} as unknown as Database;
}

export default db;
