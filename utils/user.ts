import db from "@/utils/db";

export const getUserId = async (accessToken: string) => {
  const user = accessToken && await db.get(
    `SELECT id FROM users WHERE accessToken = ?`,
    [accessToken]);
  if (!user) {
    throw Error("User is not found.")
  }
  return user.id;
}
