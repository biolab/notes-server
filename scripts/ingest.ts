import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { program } from "commander";
import readline from "readline";
import kill from "tree-kill";

import { updateDb } from "@/ingest";
import { rebuildDatabase } from "@/ingest/createDb";

import { spawn } from "node:child_process";

const startNext = () => {
  const proc = spawn(
    "yarn",
    ["start"],
    {
      stdio: "inherit",
      shell: true,
      detached: true,
      env: process.env
    }
  );

  proc.on("exit", (code) => {
    console.log(`Next.js exited with code ${code}`);
  });
  return proc;
}


program
  .option("-p, --path <path>", "Top-level subdirectory to update/check; use `-p /` for root", "")
  .option("--dev", "Run in development mode", false)
  .option("--recreate", "Recreate the database from scratch", false)
  .option("-f, --force", "Force parsing of unchanged files", false)
  .option("-c, --check", "Check, but don't update the database", false)

program.parse(process.argv);
const { path: prefix, dev, recreate, force, check } = program.opts();

if (prefix !== "/" && (prefix.includes("/") || prefix.includes("\\"))) {
  console.error("Error: The path may contain only a top-level directory name.");
  process.exit(1);
}
if (check && recreate) {
  console.error("Error: --check cannot be used with --recreate.");
  process.exit(1);
}
if (dev && check) {
  console.error("Error: --dev is incompatible with --check.");
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
    const answer =
      process.env.NEXT_PUBLIC_DEVELOPMENT ? "y"
      : await ask("" +
        "Are you sure you want to delete the database and start from scratch? (y/N) ");
    if (answer.toLowerCase() !== "y") {
      process.exit();
    }
    await rebuildDatabase();
  }

  await updateDb(prefix, check, force, dev).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

  if (dev) {
    const nextProcess = startNext();
    const shutdown = (reason?: unknown) => {
      if (reason !== undefined) {
        console.error("Error:", reason);
      }
      kill(nextProcess.pid!, "SIGTERM", () => process.exit());
    }
    process.on("uncaughtException", shutdown);
    process.on("unhandledRejection", shutdown);
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
})();
