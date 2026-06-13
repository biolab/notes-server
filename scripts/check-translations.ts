// Iterate over all .ts and .tsx files from directory ..

import fs from 'fs';
import path from 'path';
import dict from "@/i18n/dict";

const DIRS = ["api", "app", "components", "context", "hooks", "utils"];
const KNOWN_EXTRAS = ["books", "collections", "text-replacements"];

let errors = false;

export const getFiles = (p: string): string[] =>
  fs.readdirSync(p)
    .map((name: string) => path.posix.join(p, name))
    .flatMap((name: string) =>
      fs.statSync(name).isDirectory() ? getFiles(name) :
      name.endsWith('.ts') || name.endsWith('.tsx') ? [name] : [])

const keys = [...new Set(DIRS.flatMap(getFiles)
    .flatMap((p) =>
      [...fs.readFileSync(p, 'utf-8')
      .matchAll(/[\^\W]t\(([^)]+)\)/g)])
    .map((m) => m[1])
    .flatMap((args) =>
      [...args.matchAll(/(["'`])([^"'`]+)\1/g)]
        .map(m => m[2]))
)];

Object.entries(dict)
  .forEach(([lang, d]: [string, Record<string, any>]) => {
    const missing = keys.filter(k => !d[k]);
    const extra = Object.keys(d)
      .filter(k => !keys.includes(k) && !KNOWN_EXTRAS.includes(k));
    const mismatching = Object.keys(d)
      .filter(k => dict["en"][k] && typeof dict["en"][k] !== typeof d[k]);
    if (missing.length || extra.length || mismatching.length) {
      console.log(`\nIssues in ${lang}:`);
      if (missing.length) {
        console.log(`  Missing translations (${missing.length}):`);
        missing.forEach(k => console.log(`    - ${k}`));
      }
      if (extra.length) {
        console.log(`  Extra translations (${extra.length}):`);
        extra.forEach(k => console.log(`    - ${k}`));
      }
      if (mismatching.length) {
        console.log(`  Mismatching types (${mismatching.length}):`);
        mismatching.forEach(k =>
          console.log(`    - ${k} (expected ${typeof dict["en"][k]}, got ${typeof d[k]})`));
      }
      console.log("\n");
      errors = true;
    }
    else {
      console.log(`All good in ${lang}!`);
    }
  });

process.exit(errors ? 1 : 0);
