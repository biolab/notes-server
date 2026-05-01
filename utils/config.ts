import path from "path";
import fs from "fs";
import { z } from 'zod';
import { load } from "js-yaml";

const cwd = process.cwd();

const isBuildStep = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI;

const ConfigSchema = z.object({
  // Provide either base or all paths.
  // Alternatively, if cwd ends with "notes-server", cwd/.. will be used as base.
  base: z.string().optional(),

  staticPath: z.string().optional(),
  notesPath: z.string().optional(),
  dbPath: z.string().optional(),
  uploadsPath: z.string().optional(),

  // __db, and __uploads are always ignored
  ignorePrefixes: z.array(z.string()).default(["notes-server"]),

  wsPort: z.coerce.number().default(3025),
  SMTPPort: z.coerce.number().default(25),
  SMTPHost: z.string().default("localhost"),
  emailFrom: z.string().default("Notes Service <noreply@fri.uni-lj.si>"),
})
  .strict()
  .refine(
    (data) => {
      if (isBuildStep) {
        return true;
      }

      const paths = ["staticPath", "notesPath", "dbPath", "uploadsPath"] as const;
      const lastDirPath = path.basename(cwd);
      return !!data.base
        || paths.every((k) => !!data[k as keyof typeof data])
        || lastDirPath === "notes-server"
    },
    { message: "Unless the current directory is notes-server, either 'base',\n" +
               "or all of 'staticPath', 'notesPath', 'dbPath', and 'uploadsPath' must be provided."
    }
  )
  .transform((data) => {
    // Above check already ensures that cwd ends with "notes-server" if base is not provided.
    const base = data.base ?? path.resolve(cwd, "..");
    const subPath = (subdir: string) => path.posix.join(base, subdir);
    const tts = (str: string) => str.replace(/\/$/, "");

    const notesPath = tts(data.notesPath ?? (data.base ? subPath("repos") : base));
    const staticPath = tts(data.staticPath ?? notesPath);
    const dbPath = tts(data.dbPath ?? subPath("__db"));
    const uploadsPath = tts(data.uploadsPath ?? subPath("__uploads"));
    const ignorePrefixes = [...data.ignorePrefixes, "__db", "__uploads"];
    return { ...data, notesPath, staticPath, dbPath, uploadsPath, ignorePrefixes };
  })
  .superRefine((data, ctx) => {
    const checkExists = (path: string) => {
      const p = data[path as keyof typeof data] as string;
      if (!fs.existsSync(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Directory does not exist: ${p}`,
            path: [path],
          });
        }
    }
    const createDir = (p: string) => {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log("Created directory:", p);
      }
    }
    if (!isBuildStep) {
      checkExists("staticPath");
      checkExists("notesPath");
      createDir(data.dbPath);
      createDir(data.uploadsPath);
    }
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

const configFile = process.env.NOTES_CONFIG ?
  /*turbopackIgnore: true*/ process.env.NOTES_CONFIG : path.resolve(cwd, "notes.config.yml");

const fileContents = () => {
  if (fs.existsSync(configFile)) {
    try {
      return load(fs.readFileSync(configFile, "utf-8"));
    } catch (e: any) {
      throw new Error(`Could not read config file at: ${configFile}: ${e.message}`);
    }
  }
  return {};
}

export const CONFIG = ConfigSchema.parse(fileContents());
