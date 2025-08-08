import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { program } from "commander";
import readline from "readline";

import { updateDb } from "@/ingest";
import { rebuildDatabase } from "@/ingest/createDb";

program
  .option("-p, --path <path>", "Path to the directory to update", "")
  .option("-u, --update", "Update without increasing the build number", false)
  .option("--recreate", "Recreate the database from scratch", false)
  .option("-c --check", "Check, but don't update the database", false);
program.parseOptions(process.argv.slice(2));
const { path: pathPrefix, update, recreate, check } = program.opts();

if (pathPrefix.includes("/") || pathPrefix.includes("\\")) {
  console.error("Error: The path may contain only a top-level directory name.");
  process.exit(1);
}
if (check && (update || recreate)) {
  console.error("Error: --check cannot be used with --update or --recreate.");
  process.exit(1);
}

const ask = (question: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans);
  }));
}

(async () => {
  if (recreate) {
    const answer = await ask("" +
      "Are you sure you want to delete the database and start from scratch? (y/N) ");
    if (answer.toLowerCase() !== "y") {
      process.exit();
    }
    await rebuildDatabase();
  }

  await updateDb(pathPrefix, update, check).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
})();