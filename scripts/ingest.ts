import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { program } from "commander";
import readline from "readline";
import fs from "fs";

import { updateDb } from "@/ingest";
import { rebuildDatabase } from "@/ingest/createDb";
import { setNotesPath } from "@/ingest/paths";

import { spawn } from "node:child_process";

const startNext = () => {
  const proc = spawn(
    "yarn",
    ["start"],
    {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
//        NODE_ENV: "development",
      },
    }
  );

  proc.on("exit", (code) => {
    console.log(`Next.js exited with code ${code}`);
  });
  return proc;
}


program
  .option("-p, --path <path>", "Top-level subdirectory to update/check", "")
  .option("--dev", "Run in development mode", false)
  .option("--recreate", "Recreate the database from scratch", false)
  .option("-c, --check", "Check, but don't update the database", false)
  .option("-e, --exceptions <path>", "Yaml file with moved books and books with relaxed checks", "")
  .argument("[path]", "Path to the notes directory (default: from .env)", "");

program.parse(process.argv);
const { path: prefix, dev, recreate, check, exceptions } = program.opts();
const [notesPath] = program.args;

if (prefix.includes("/") || prefix.includes("\\")) {
  console.error("Error: The path may contain only a top-level directory name.");
  process.exit(1);
}
if (check && recreate) {
  console.error("Error: --check cannot be used with --recreate.");
  process.exit(1);
}

if (dev && (check || exceptions)) {
  console.error("Error: --dev is incompatible with --check, and --exceptions.");
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

  await updateDb(prefix, check, exceptions, dev).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

  if (dev) {
    const nextProcess = startNext();
    const shutdown = () => {
      nextProcess.kill("SIGTERM");
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
})();
