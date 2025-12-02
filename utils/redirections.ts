import db from "@/utils/db";

let redirections: [string, string][] | null = null;

export async function loadRedirections() {
  redirections = (await db.all("SELECT path, target FROM redirections"))
      .map(({path, target}) => [path, target] as [string, string]);
}

export const getRedirections = async () => {
  if (!redirections) {
    await loadRedirections();
  }
  return redirections!;
}
