"use server";

import db from "@/utils/db";

export const getSubmissions = async ({
  adminAccessToken,
  slug,
}: {
  adminAccessToken: string;
  slug: string;
}) => {
  const userFromDb = await db.get(
    `SELECT id FROM users WHERE accessToken = ? and deleted = 0`,
    [adminAccessToken]
  );

  if (!userFromDb || !userFromDb.admin) {
    throw new Error("User not found or not admin");
  }
};
