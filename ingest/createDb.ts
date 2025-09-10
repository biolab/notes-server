import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const DB_PATH = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_PATH, "notes.sqlite");

export const rebuildDatabase = async () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH);
  }
  const conn = new sqlite3.Database(DB_FILE);
  const run = promisify(conn.run.bind(conn));

  const LAST_BUILD_ID =  "lastBuildId INTEGER NOT NULL REFERENCES builds (id) ON DELETE RESTRICT"

  const handle = async (table: string) => {
    // This is to enable having some log when recreating the database.
    // Otherwise we get SQLITE errors with too little information.

    // console.log("Dropping and recreating table:", table);
    try {
      await run(`DROP TABLE IF EXISTS ${table}`);
    } catch (err) {
      console.error(`Error dropping table ${table}:`, err);
    }
  }

  try {
    await handle("builds");
    await run(`
        CREATE TABLE builds
        (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            path      TEXT NOT NULL,
            timestamp TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            output    TEXT NOT NULL DEFAULT ''
        );
    `);

    await handle("collections");
    await run(`
        CREATE TABLE collections
        (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            path             TEXT    NOT NULL UNIQUE,
            title            TEXT    NOT NULL,
            subtitle         TEXT,
            public           BOOLEAN NOT NULL DEFAULT 0,
            language         TEXT    NOT NULL DEFAULT 'en',
            coverImg         TEXT,
            recursiveContent BOOLEAN NOT NULL DEFAULT 0,
            content          TEXT,
            ${LAST_BUILD_ID}
        );
    `);

    await handle("books");
    await run(`
        CREATE TABLE books
        (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            path                 TEXT    NOT NULL UNIQUE,
            title                TEXT    NOT NULL,
            subtitle             TEXT,
            public               BOOLEAN NOT NULL DEFAULT 0,
            language             TEXT    NOT NULL DEFAULT 'en',
            tocInHeader          BOOLEAN NOT NULL DEFAULT 1,
            coverImg             TEXT,
            requireLogin         BOOLEAN NOT NULL DEFAULT 0,
            quizThreshold        INTEGER          DEFAULT NULL,
            loginSubtitle        TEXT,
            email_subject        TEXT,
            email_body           TEXT,
            content              TEXT    NOT NULL,
            ${LAST_BUILD_ID}
        );
    `);

    await handle("groups");
    await run(`
        CREATE TABLE groups
        (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT NOT NULL UNIQUE
        );
    `);

    await handle("tokens");
    await run(`
        CREATE TABLE tokens
        (
            id     INTEGER PRIMARY KEY AUTOINCREMENT,
            token  TEXT NOT NULL UNIQUE
        );
    `);

    await handle("books_groups");
    await run(`
        CREATE TABLE books_groups
        (
            bookId  INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            groupId INTEGER DEFAULT NULL REFERENCES groups (id) ON DELETE SET NULL,
            tokenId INTEGER DEFAULT NULL REFERENCES tokens (id) ON DELETE SET NULL,
            
            UNIQUE (bookId, groupId, tokenId)
        );
    `);

    await handle("chapters");
    await run(`
        CREATE TABLE chapters
        (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            path          TEXT    NOT NULL UNIQUE,
            title         TEXT    NOT NULL,
            omitAsChapter BOOLEAN NOT NULL DEFAULT 0,
            content       TEXT,
            ${LAST_BUILD_ID}
        );
    `);

    await handle("collections_collections");
    await run(`
        CREATE TABLE collections_collections
        (
            collectionId    INTEGER NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
            subCollectionId INTEGER NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
            position        INTEGER NOT NULL,
            explicit        BOOLEAN NOT NULL,
            ${LAST_BUILD_ID},

            UNIQUE (collectionId, subCollectionId)
        );
    `);

    await handle("collections_books");
    await run(`
        CREATE TABLE collections_books
        (
            collectionId INTEGER NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
            bookId       INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            position     INTEGER NOT NULL,
            explicit     BOOLEAN NOT NULL,
            ${LAST_BUILD_ID},

            UNIQUE (collectionId, bookId)
        );
    `);

    await handle("books_chapters");
    await run(`
        CREATE TABLE books_chapters
        (
            bookId      INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            chapterId   INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
            position    INTEGER NOT NULL,
            ${LAST_BUILD_ID},

            UNIQUE (bookId, chapterId)
        );
    `);

    await handle("questions");
    await run(`
        CREATE TABLE questions
        (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            chapterId    INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
            position     INTEGER NOT NULL,
            questionId   TEXT    NOT NULL,
            question     TEXT    NOT NULL,
            options      TEXT,
            answer       TEXT,
            questionType TEXT    NOT NULL,
            ${LAST_BUILD_ID},
            
            UNIQUE (chapterId, questionId)
        );
    `);

    await handle("users");
    await run(`
        CREATE TABLE users
        (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            accessToken  TEXT UNIQUE NOT NULL,
            name         TEXT DEFAULT NULL,
            surname      TEXT DEFAULT NULL,
            email        TEXT UNIQUE DEFAULT NULL,
            admin        BOOLEAN   NOT NULL DEFAULT 0,
            createdAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lastUseAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await handle("temporary_tokens");
    await run(`
        CREATE TABLE temporary_tokens
        (
            emailToken    TEXT PRIMARY KEY,
            userId        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name          TEXT DEFAULT NULL,
            surname       TEXT DEFAULT NULL,
            email         TEXT UNIQUE DEFAULT NULL,
            expires       TIMESTAMP NOT NULL DEFAULT (DATETIME('now', '+4 hours'))
        ); 
    `);

    await handle("users_books");
    await run(`
        CREATE TABLE users_books
        (
            userId      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            bookId      INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            groupId     INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
            
            UNIQUE (userId, bookId)
        );
    `);

    await handle("users_tokens");
    await run(`
        CREATE TABLE users_tokens
        (
            userId     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            tokenId    INTEGER NOT NULL REFERENCES tokens (id) ON DELETE CASCADE,
            
            UNIQUE (userId, tokenId)
        );
    `);

    await handle("answers");
    await run(`
        CREATE TABLE answers
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            userId      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            bookId      INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            groupId     INTEGER DEFAULT NULL REFERENCES groups (id) ON DELETE SET NULL,
            questionId  INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
            answer      TEXT NOT NULL,
            isCorrect   BOOLEAN,
            points      INTEGER
        );
    `);

    await handle("faviconpaths");
    await run(`
        CREATE TABLE faviconpaths
        (
            path        TEXT NOT NULL,
            ${LAST_BUILD_ID}
        )
    `)

    await handle("book_admins");
    await run(`
        CREATE TABLE book_admins
        (
            email       TEXT NOT NULL,
            bookId     INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
            UNIQUE (email, bookId)
        );
    `);

    await handle("collection_admins");
    await run(`
        CREATE TABLE collection_admins
        (
            email         TEXT NOT NULL,
            collectionId  INTEGER NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
            UNIQUE (email, collectionId)
        );
    `);
  }
  finally {
    conn.close();
  }
}
