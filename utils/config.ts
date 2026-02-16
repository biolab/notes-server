import path from "path";
import fs from "fs";
import { z } from 'zod';

const cwd = process.cwd();

export const ConfigSchema = z.object({
  notesPath: z.string().default(cwd),
  dbPath: z.string().default(path.join(cwd, "db")),
  uploadsPath: z.string().default(path.join(cwd, "uploads")),
  wsPort: z.coerce.number().default(3025),
  SMTPPort: z.coerce.number().default(25),
  SMTPHost: z.string().default("localhost"),
  emailFrom: z.string().default("Notes Service <noreply@fri.uni-lj.si>"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;


const configFile = process.env.NOTES_CONFIG || path.resolve(cwd, "notes.config.json");

const fileContents = () => {
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, "utf-8"));
    } catch (e: any) {
      throw new Error(`Could not read config file at: ${configFile}: ${e.message}`);
    }
  }
  return {};
}

export const CONFIG = ConfigSchema.parse(fileContents());
