"use server";

import withDb from "@/utils/db";

export const _getSubmissions = async ({
  adminAccessToken,
  slug,
}: {
  adminAccessToken: string;
  slug: string;
}) => {
  const db = await withDb();
  const userFromDb = await db.get(
    `SELECT id FROM users WHERE accessToken = ? and deleted = 0`,
    [adminAccessToken]
  );

  if (!userFromDb || !userFromDb.admin) {
    await db.close();
    throw new Error("User not found or not admin");
  }
};
