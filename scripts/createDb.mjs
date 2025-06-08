import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, 'notes.sqlite');

async function rebuildDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH);
  }
  const conn = new sqlite3.Database(DB_FILE);

  await conn.exec(`DROP TABLE IF EXISTS builds`);
  await conn.exec(`
      CREATE TABLE builds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trigger TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          output TEXT NOT NULL DEFAULT ''
      );
  `);

  await conn.exec(`DROP TABLE IF EXISTS collections`);
  await conn.exec(`
      CREATE TABLE collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          lastBuildId INTEGER NOT NULL,
          
          FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
  `);

  await conn.exec(`DROP TABLE IF EXISTS books`);
  await conn.exec(`
      CREATE TABLE books (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           path TEXT NOT NULL UNIQUE,
           title TEXT NOT NULL,
           lastBuildId INTEGER NOT NULL,

           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
   `);

  await conn.exec(`DROP TABLE IF EXISTS chapters`);
  await conn.exec(`
      CREATE TABLE chapters (
          id    INTEGER PRIMARY KEY AUTOINCREMENT,
          path  TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          lastBuildId INTEGER NOT NULL,

          FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
    `);

  await conn.exec(`DROP TABLE IF EXISTS collections_collections`);
  await conn.exec(`
      CREATE TABLE collections_collections (
           collectionId INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
           subCollectionId INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
           lastBuildId INTEGER NOT NULL,
          
           UNIQUE(collectionId, subCollectionId),
           FOREIGN KEY(collectionId) REFERENCES collections(id) ON DELETE CASCADE,
           FOREIGN KEY(subCollectionId) REFERENCES collections(id) ON DELETE CASCADE,
           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
        );
    `);

  await conn.exec(`DROP TABLE IF EXISTS collections_books`);
  await conn.exec(`
      CREATE TABLE collections_books (
           collectionId INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
           bookId INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
           lastBuildId INTEGER NOT NULL,
          
           UNIQUE(collectionId, bookId),
           FOREIGN KEY(collectionId) REFERENCES collections(id) ON DELETE CASCADE,
           FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE,
           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
        );
    `);

  await conn.exec(`DROP TABLE IF EXISTS books_chapters`);
  await conn.exec(`
      CREATE TABLE books_chapters (
           bookId INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
           chapterId INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
           lastBuildId INTEGER NOT NULL,
          
           UNIQUE(bookId, chapterId),
           FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE,
           FOREIGN KEY(chapterId) REFERENCES chapters(id) ON DELETE CASCADE,
           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
        );
    `);

  await conn.exec(`DROP TABLE IF EXISTS questions`);
  await conn.exec(`
      CREATE TABLE questions (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           chapterId INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
           questionId TEXT NOT NULL,
           question TEXT NOT NULL,
           lastBuildId INTEGER NOT NULL,
          
           UNIQUE(chapterId, questionId),
           FOREIGN KEY(chapterId) REFERENCES chapters(id) ON DELETE CASCADE,
           FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
        );
    `);
}

rebuildDatabase().catch((err) => {
  console.error('Error rebuilding database:', err);
  process.exit(1);
});