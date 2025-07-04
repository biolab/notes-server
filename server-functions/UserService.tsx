"use server";

import { v4 } from "uuid";
import withDb from "@/utils/db";
import { EmailService_Send } from "./EmailService";

export const UserService_Get = async ({
  access_token,
}: {
  access_token: string;
}) => {
  const db = await withDb();

  const existingUser = await db.get(
    `SELECT id, access_token, email FROM users WHERE access_token = ? and deleted = 0`,
    [access_token]
  );

  if (!existingUser) {
    return null;
  }

  // Update last use timestamp
  await db.run(
    `UPDATE users SET last_use_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [existingUser.id]
  );

  await db.close();

  return existingUser;
};

export const UserService_Create = async ({ email }: { email: string }) => {
  const db = await withDb();

  const existingUser = await db.get(`SELECT * FROM users WHERE email = ?`, [
    email,
  ]);

  if (existingUser) {
    await db.close();

    try {
      await EmailService_Send({
        email: email,
        sendTo: email,
        subject: "Welcome back!",
        text: `Hello! Welcome back to our platform. Your access token is: ${existingUser.access_token}`,
        html: `<p>Hello! Welcome back to our platform. Your access token is: <strong>${existingUser.access_token}</strong></p>`,
      });
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
    return existingUser;
  }

  const accessToken = v4();

  await db.run(`INSERT INTO users (email, access_token) VALUES (?, ?)`, [
    email,
    accessToken,
  ]);

  const user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);

  await db.close();

  return user;
};
