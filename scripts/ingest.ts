import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { program } from "commander";
import readline from "readline";
import fs from "fs";

import { updateDb } from "@/ingest";
import { rebuildDatabase } from "@/ingest/createDb";
import { setNotesPath } from "@/ingest/paths";

program
  .option("-p, --path <path>", "Top-level subdirectory to update/check", "")
  .option("-u, --update", "Update without increasing the build number", false)
  .option("--recreate", "Recreate the database from scratch", false)
  .option("-c, --check", "Check, but don't update the database", false)
  .option("-e, --exceptions <path>", "Yaml file with moved books and books with relaxed checks", "")
  .argument("[path]", "Path to the notes directory (default: from .env)", "");

program.parse(process.argv);
const { path: pathPrefix, update, recreate, check, exceptions } = program.opts();
const [notesPath] = program.args;

if (pathPrefix.includes("/") || pathPrefix.includes("\\")) {
  console.error("Error: The path may contain only a top-level directory name.");
  process.exit(1);
}
if (check && (update || recreate)) {
  console.error("Error: --check cannot be used with --update or --recreate.");
  process.exit(1);
}

if (notesPath) {
  if (!fs.existsSync(notesPath)) {
    console.error(`Error: Path ${notesPath} does not exist.`);
    process.exit(1);
  }
  setNotesPath(notesPath);
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
    const answer =
      process.env.DEVELOPMENT ? "y"
      : await ask("" +
        "Are you sure you want to delete the database and start from scratch? (y/N) ");
    if (answer.toLowerCase() !== "y") {
      process.exit();
    }
    await rebuildDatabase();
  }

  await updateDb(pathPrefix, update, check, exceptions).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
})();
