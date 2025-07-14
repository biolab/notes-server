"use server";

import { v4 } from "uuid";
import withDb from "@/utils/db";
import { EmailService_Send } from "./EmailService";
import { logger } from "@/utils/logger";

export const UserService_Get = async ({
  accessToken,
}: {
  accessToken: string;
}) => {
  const db = await withDb();

  const existingUser = await db.get(
    `SELECT id, accessToken, email FROM users WHERE accessToken = ? and deleted = 0`,
    [accessToken]
  );

  if (!existingUser) {
    return null;
  }

  // Update last use timestamp
  await db.run(`UPDATE users SET lastUseAt = CURRENT_TIMESTAMP WHERE id = ?`, [
    existingUser.id,
  ]);

  await db.close();

  return existingUser;
};

export const UserService_Delete = async ({
  accessToken,
}: {
  accessToken?: string;
}) => {
  if (!accessToken) {
    return;
  }

  const db = await withDb();

  const existingUser = await db.get(
    `SELECT * FROM users WHERE accessToken = ? and deleted = 0`,
    [accessToken]
  );

  if (!existingUser) {
    return;
  }

  // Delete user data
  await db.run(`DELETE FROM answers WHERE userId = ?`, [existingUser.id]);

  await db.run(
    `UPDATE users SET deleted = 1, deletedCount = deletedCount + 1 WHERE id = ?`,
    [existingUser.id]
  );

  await db.close();
};

export const UserService_Create = async ({
  email,
  emailContent,
  url,
}: {
  email: string | null;
  emailContent?: {
    subject: string;
    body: string;
  };
  url?: string;
}) => {
  const db = await withDb();

  let user = null;

  if (email) {
    user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);

    if (user && user.deleted) {
      await db.run(`UPDATE users SET deleted = 0 WHERE id = ?`, [user.id]);
    }
  }

  if (!user) {
    const accessToken = v4();

    await db.run(`INSERT INTO users (email, accessToken) VALUES (?, ?)`, [
      email,
      accessToken,
    ]);

    user = await db.get(
      `SELECT id, accessToken, email FROM users WHERE accessToken = ?`,
      [accessToken]
    );
  }

  await db.close();

  let link = null;

  if (user.email) {
    try {
      link = `${url}?accessToken=${user.accessToken}`;

      const emailBody = (
        emailContent?.body ||
        "Hello, here is your <a href='{url}'>link to the book</a>"
      ).replace("{url}", link);

      logger("Sending email to:", user.email, "with body:", emailBody);

      await EmailService_Send({
        sendTo: user.email,
        subject: emailContent?.subject || "",
        html: emailBody,
      });
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  }

  return {
    user,
    link: process.env.NODE_ENV === "development" ? link : null,
  };
};
