import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

async function rebuildDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH);
  }
  const conn = new sqlite3.Database(DB_FILE);

  conn.exec(`DROP TABLE IF EXISTS builds`);
  conn.exec(`
      CREATE TABLE builds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          output TEXT NOT NULL DEFAULT ''
      );
  `);

  conn.exec(`DROP TABLE IF EXISTS collections`);
  conn.exec(`
      CREATE TABLE collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          subtitle TEXT,
          lastBuildId INTEGER NOT NULL,
          date TEXT,
          description TEXT,
          public BOOLEAN NOT NULL DEFAULT 0,
          language TEXT NOT NULL DEFAULT 'en',
          coverImg TEXT,
          recursiveContent BOOLEAN NOT NULL DEFAULT 0,

      FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
  `);

  conn.exec(`DROP TABLE IF EXISTS books`);
  conn.exec(`
      CREATE TABLE books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lastBuildId INTEGER NOT NULL,
          path TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          subtitle TEXT,
          description TEXT,
          date TEXT,
          public BOOLEAN NOT NULL DEFAULT 0,
          language TEXT NOT NULL DEFAULT 'en',
          tocInHeader BOOLEAN NOT NULL DEFAULT 1,
          indexInitiallyClosed BOOLEAN NOT NULL DEFAULT 0,
          coverImg TEXT,
          requireLogin BOOLEAN NOT NULL DEFAULT 0,
          quizThreshold INTEGER DEFAULT NULL,
          loginSubtitle TEXT,
          email_subject TEXT,
          email_body TEXT,
          content TEXT NOT NULL,

      FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
   `);

  conn.exec(`DROP TABLE IF EXISTS chapters`);
  conn.exec(`
      CREATE TABLE chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lastBuildId INTEGER NOT NULL,
          path  TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          omitAsChapter BOOLEAN NOT NULL DEFAULT 0,
          content TEXT,
        
          FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
      );
    `);

  conn.exec(`DROP TABLE IF EXISTS collections_collections`);
  conn.exec(`
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

  conn.exec(`DROP TABLE IF EXISTS collections_books`);
  conn.exec(`
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

  conn.exec(`DROP TABLE IF EXISTS books_chapters`);
  conn.exec(`
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

  conn.exec(`DROP TABLE IF EXISTS questions`);
  conn.exec(`
      CREATE TABLE questions (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           chapterId INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
           questionId TEXT NOT NULL,
           question TEXT NOT NULL,
           options TEXT,
           answer TEXT,
           questionType TEXT NOT NULL,
           lastBuildId INTEGER NOT NULL,
          
           UNIQUE(chapterId, questionId),
           FOREIGN KEY(chapterId) REFERENCES chapters(id) ON DELETE CASCADE,
           FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
           FOREIGN KEY(lastBuildId) REFERENCES builds(id) ON DELETE RESTRICT
        );
    `);

  conn.exec(`DROP TABLE IF EXISTS users`);
  conn.exec(`
      CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE DEFAULT NULL,
          accessToken TEXT NOT NULL,
          admin BOOLEAN NOT NULL DEFAULT 0,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lastUseAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted BOOLEAN NOT NULL DEFAULT 0,
          deletedCount INTEGER NOT NULL DEFAULT 0,
          UNIQUE(email)
      );
  `);

  conn.exec(`DROP TABLE IF EXISTS answers`);
  conn.exec(`
      CREATE TABLE answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          userId INTEGER NOT NULL,
          bookId TEXT,
          questionId TEXT NOT NULL,
          answerValue JSON NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
          FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE SET NULL 
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE SET NULL 
      );
  `);
}

rebuildDatabase().catch((err) => {
  console.error("Error rebuilding database:", err);
  process.exit(1);
});
