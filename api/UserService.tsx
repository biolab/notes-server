"use server";

import { v4 } from "uuid";
import { sendEmail } from "./EmailService";
import { logger } from "@/utils/logger";
import db from "@/utils/db";
import { User } from "@/context/UserContextProvider";

export const getUserId = async (accessToken: string): Promise<number> => {
  const user = await db.get(
    `SELECT id FROM users WHERE accessToken = ? and deleted = 0`,
    [accessToken]
  );
  return user?.id ?? null;
};

export const getUser = async ({ accessToken }: { accessToken: string }) => {
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

  return existingUser;
};

export const _deleteUser = async (user: User) => {
  const userId = await getUserId(user.accessToken);
  if (!userId) {
    throw Error("User is not found.")
  }

  // Delete user data
  await db.run(`DELETE FROM answers WHERE userId = ?`, [userId]);

  await db.run(
    `UPDATE users SET deleted = 1, deletedCount = deletedCount + 1 WHERE id = ?`,
    [userId]
  );
};

export const registerUser = async ({
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
  if (!email) {
    logger("registerUser: Called without email; this shouldn't have happened");
  }

  let user = null;

  if (email) {
    user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);

    if (user && user.deleted) {
      await db.run(`UPDATE users SET deleted = 0 WHERE id = ?`, [user.id]);
    }
  }

  if (!user) {
    const accessToken = v4();

    user = await db.get(
      `
      INSERT INTO users (email, accessToken) 
      VALUES (?, ?)
      RETURNING id, accessToken, email`,
      [email, accessToken]
    );
  }

  let link = null;

  if (user.email) {
    try {
      link = `${url}?accessToken=${user.accessToken}`;

      const emailBody = (
        emailContent?.body ||
        "Hello, here is your <a href='{url}'>link to the book</a>"
      ).replace("{url}", link);

      logger("Sending email to:", user.email, "with body:", emailBody);

      await sendEmail({
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
