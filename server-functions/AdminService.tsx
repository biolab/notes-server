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

  const submissions = await db.all(
    `SELECT * FROM quiz_states WHERE book_slug = ? AND is_quiz_complete = 1 ORDER BY created_at DESC`,
    [slug]
  );

  await db.close();

  return submissions.map((submission) => ({
    ...submission,
    state: JSON.parse(submission.state),
  }));
};
