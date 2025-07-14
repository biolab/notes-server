"use server";

import withDb from "@/utils/db";

export const AdminService_GetSubmissions = async ({
  adminAccessToken,
  slug,
}: {
  adminAccessToken: string;
  slug: string;
}) => {
  const db = await withDb();
  const userFromDb = await db.get(
    `SELECT id FROM users WHERE access_token = ? and deleted = 0`,
    [adminAccessToken]
  );

  if (!userFromDb || !userFromDb.admin) {
    await db.close();
    throw new Error("User not found or not admin");
  }
};
