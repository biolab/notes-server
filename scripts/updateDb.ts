import { program } from "commander";
import { updateDb } from "@/ingest";

program
  .option("-p, --path <path>", "Path to the directory to update", "")
  .option("-u, --update", "Update without increasing the build number", false)
  .option("-b, --base <path>", "Base path for libraries");
program.parseOptions(process.argv.slice(2));
const { path: pathPrefix, update, base } = program.opts();

if (pathPrefix && update) {
  console.error("Both --path and --update options are provided. Please provide only one.");
  process.exit(1);
}

updateDb(base, pathPrefix, update).catch((err) => {
  console.error("Error making a new build:", err);
  process.exit(1);
});
