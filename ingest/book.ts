import fs from "fs";
import path from "path";

import { RawBookFrontmatter, ChapterDefBase, ChapterFrontmatter } from "@/types/types";
import { pathExists } from "@/ingest/paths";
import { checkedMatter, getMdFile, isListOfStrings, parseMd, readPublicDirMd } from "./md-helpers";
import { catchErrors, logError } from "@/ingest/errors";
import { extractQuizzes } from "@/ingest/questions";

const chapterFrontmatterDefaults: ChapterFrontmatter = {
  title: "",
  omitAsChapter: false,
};

const bookFrontmatterDefaults: RawBookFrontmatter = {
  title: "",
  subTitle: "",
  public: true,
  language: "en",
  tocInHeader: false,
  coverImg: "",
  requireLogin: false,
  quizThreshold: 0,
} satisfies RawBookFrontmatter & Record<string, unknown>;

const extraBookMatter = {
  groups: [],
  tokens: [],
  admins: [],
  chapters: [] as string[],
} satisfies Record<string, unknown>;

export const bookMatter = (indexMd: string, slug: string | null = null) =>
  checkedMatter(
    indexMd, bookFrontmatterDefaults, extraBookMatter, slug,
    {
      groups: (value) =>
        Array.isArray(value)
          ? (value.some((x) => typeof(x) !== "string")
            && "All groups must be strings")
        : typeof(value) === "object"
          ? (Object.values(value).some((token) => typeof(token) !== "string")
            && "All groups and tokens must be strings")
        : "'groups' must be a list of strings, or string pairs without dashes",
      tokens: isListOfStrings,
      admins: isListOfStrings,
    }
  );

const chapterMatter = (chapterMd: string, slug: string | null = null) =>
  checkedMatter(chapterMd, chapterFrontmatterDefaults, {}, slug);

export interface RawChapterDef extends ChapterDefBase {
  mdxContent: string;
}

export type RawBookDef = {
  slug: string;
  frontmatter: RawBookFrontmatter;
  mdxContent: string;
  chapters: RawChapterDef[];
};

export const parseBook = async (pathParts: string[]): Promise<RawBookDef> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd);
  const mdxContent = parseMd(content);

  const chapterDirs =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("/")
        ? path.join(pathParts[0], _slug.slice(1))
        : _slug.startsWith("./")
        ? path.join(...pathParts, _slug.slice(2))
        : path.join(pathParts[0], "_chapters", _slug)
    ) ||
    readPublicDirMd(pathParts)
      .map((chapterDir) => path.join(...pathParts, chapterDir))
      .sort();

  const chapters = [];
  for (const chapterDir of chapterDirs) {
    if (!pathExists(chapterDir)) {
      logError(fullPath, `Chapter directory ${chapterDir} does not exist.`);
      continue;
    }

    const index = await catchErrors(
      chapterDir, async () => getMdFile(chapterDir));
    if (!index) {
      continue;
    }
    const chapterMd = fs.readFileSync(index, "utf-8");
    const { frontmatter, content } = chapterMatter(chapterMd, chapterDir);
    const mdxContent = parseMd(content);
    const questions = await extractQuizzes(mdxContent, chapterDir);
    chapters.push({
      chapterDir,
      frontmatter,
      mdxContent,
      questions,
    });
  }
  return {
    slug: fullPath,
    frontmatter,
    mdxContent,
    chapters,
  };
};

