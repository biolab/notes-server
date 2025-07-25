import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { program } from "commander";
import readline from "readline";

import { updateDb } from "@/ingest";
import { rebuildDatabase } from "@/ingest/createDb";

program
  .option("-p, --path <path>", "Path to the directory to update", "")
  .option("-u, --update", "Update without increasing the build number", false)
  .option("--recreate", "Recreate the database from scratch", false);
program.parseOptions(process.argv.slice(2));
const { path: pathPrefix, update, recreate } = program.opts();

if (pathPrefix && update) {
  console.error("Both --path and --update options are provided. Please provide only one.");
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

  await updateDb(pathPrefix, update).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
})();