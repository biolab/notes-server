"use server";

import { v4 } from "uuid";
import db from "@/utils/db";

import { getUserId } from "@/utils/user";


export interface User {
  accessToken: string;
  name?: string;
  surname?: string;
  email?: string;
  id: number;
  groups: {[bookId: number]: string};
  tokens: string[];
  admin: boolean;
}

export const getUser = async (accessToken: string) => {
  const user = await db.get(
    `SELECT * FROM users WHERE accessToken = ?`,
    [accessToken]
  );
  if (!user) {
    return null;
  }
  await db.run(
    `UPDATE users SET lastUseAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [user.id]
  );

  user.tokens =
    (await db.all(`
      SELECT token as name FROM tokens
      JOIN users_tokens ut ON ut.tokenId = tokens.id
      WHERE ut.userId = ?`,
      [user.id]) as ({ name: string }[])
    ).map(r => r.name);

  user.groups = Object.fromEntries(
    (
      (await db.all(`
        SELECT groups.name, ub.bookId as bookId FROM groups
        JOIN users_books ub ON ub.groupId = groups.id
        WHERE ub.userId = ?`,
        [user.id])
      ) as { bookId: number; name: string }[]
    )
    .map(({ bookId, name }) => [bookId, name])
  );

  user.admin = !!user.admin;

  return user;
};

export const isAdminFor = async ({accessToken, bookId, collectionId}:
  { accessToken: string;
    bookId?: number;
    collectionId?: number }
): Promise<boolean> => {
  const user = await db.get(`
      SELECT admin, email FROM users WHERE accessToken = ?`,
      [accessToken]);
  return user && !!(
    user.admin
    || bookId && await db.get(
      `SELECT 1 FROM book_admins WHERE bookId = ? AND email == ?`,
      [bookId, user.email])
    || bookId && await db.get(
      `SELECT 1 FROM collections_books cb
       JOIN collection_admins ca ON cb.collectionId = ca.collectionId
       WHERE cb.bookId = ? AND ca.email == ?`,
      [bookId, user.email]
    )
    || collectionId && await db.get(
      `SELECT 1 FROM collection_admins WHERE collectionId = ? AND email == ?`,
      [collectionId, user.email])
  );
}

export const checkMailExists = async (email: string) =>
  !!(await db.get(
    `SELECT 1 FROM users WHERE email = ?`,
    [email]
  ));

export const deleteUser = async (accessToken: string) => {
  await db.run(`DELETE FROM users WHERE accessToken = ?`, [accessToken]); // this will cascade
};

export const createUser = async (): Promise<User> => {
  const accessToken = v4();
  await db.get(`INSERT INTO users (accessToken)
                VALUES (?)`, [accessToken]);
  return getUser(accessToken);
}

export const applyTemporaryToken = async (token: string): Promise<User> => {
  await db.run(`
    DELETE FROM temporary_tokens WHERE expires < datetime('now')`);

  const tempData = await db.get(
    `SELECT * FROM temporary_tokens WHERE emailToken = ?`,
    [token]
  );
  if (!tempData) {
    throw Error("Token not found or expired.");
  }
  const { userId, name, surname, email } = tempData;
  const user = await db.get(
    `SELECT * FROM users WHERE id = ?`,
    [userId]
  ) as (User | null);
  if (!user) {
    throw Error("User not found.");
  }

  const existingUser = await db.get(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );

  if (existingUser) {
    // Merge this user into existingUser
    await db.run(`
      UPDATE answers SET userId = ? WHERE userId = ?`,
      [existingUser.id, userId]
    );
    await db.run(`
      INSERT INTO users_books (userId, bookId, groupId)
      SELECT ?, bookId, groupId FROM users_books WHERE userId = ?
      ON CONFLICT(userId, bookId) DO UPDATE SET groupId = excluded.groupId;`,
      [existingUser.id, userId]);
    await db.run(`
      INSERT INTO users_tokens (userId, tokenId)
      SELECT ?, tokenId FROM users_tokens WHERE userId = ?
      ON CONFLICT(userId, tokenId) DO NOTHING;`,
      [existingUser.id, userId]);

    // Delete temporary user, with cascade to temporary_tokens and other tables
    await db.run(`DELETE FROM users WHERE id = ?`, [userId]);

    // Update name and surname if provided
    if (name || surname) {
      await db.run(
        `UPDATE users SET name = ?, surname = ? WHERE id = ?`,
        [name || existingUser.name,
         surname || existingUser.surname,
         existingUser.id]
      );
      if (name) {
        existingUser.name = name;
      }
      if (surname) {
        existingUser.surname = surname;
      }
    }

    return existingUser;
  }

  // Otherwise, just set the new user's data
  await db.run(`DELETE FROM temporary_tokens WHERE emailToken = ?`, [token]);
  await db.run(
    `UPDATE users SET name = ?, surname = ?, email = ? WHERE id = ?`,
    [name, surname, email, userId]
  );
  user.email = email;
  user.name = name;
  user.surname = surname;
  return user;
}

export const setUserGroupAndToken = async (
  accessToken: string, bookId: number, group: string | null, token: string | null) =>
{
  const userId = await getUserId(accessToken);

  if (group) {
    await db.run(
      `INSERT OR IGNORE INTO users_books (userId, bookId, groupId)
       SELECT ?, ?, id FROM groups WHERE name = ?;
      `,
      [userId, bookId, group]
    );
  }
  if (token) {
    await db.run(
      `INSERT OR IGNORE INTO users_tokens (userId, tokenId)
       SELECT ?, id FROM tokens WHERE token = ?;
      `,
      [userId, token]
    );
  }
}

export const setTemporaryData = async (
  { userId, email, name, surname }:
  { userId: number, email: string, name?: string, surname?: string}) =>
{
  const emailToken = v4();
  await db.run(`
    INSERT INTO temporary_tokens (emailToken, userId, name, surname, email)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET emailToken = excluded.emailToken,
                              userId = excluded.userId,
                              name = excluded.name,
                              surname = excluded.surname;`,
    [emailToken, userId, name || null, surname || null, email]);
  return emailToken;
}