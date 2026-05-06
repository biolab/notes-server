import fs from "fs";
import path from "path";

import { RawBookFrontmatter, ChapterDefBase, ChapterFrontmatter, UnlockChaptersOnAnswersOptions } from "@/types";

import { pathExists } from "./paths";
import { checkedMatter, CollectedDefaults, defaultsFor, getMdFile, isListOfStrings, parseMd, readPublicDirMd } from "./md-helpers";
import { catchErrors, catchErrorsSync, logError } from "./errors";
import { extractQuizzes } from "./questions";


const chapterFrontmatterDefaults: ChapterFrontmatter = {
  title: "",
  omitAsChapter: false,
};

const bookFrontmatterDefaults: RawBookFrontmatter = {
  title: "",
  subTitle: "",
  public: true,
  language: "",
  tocInHeader: false,
  coverImg: "",
  requireLogin: false,
  quizThreshold: 0,
  unlockChaptersOnAnswers: UnlockChaptersOnAnswersOptions[0],
  env: {},
} satisfies RawBookFrontmatter & Record<string, unknown>;

const extraBookMatter = {
  groups: [],
  tokens: [],
  admins: [],
  chapters: [] as string[],
} satisfies Record<string, unknown>;

export const bookMatter = (indexMd: string, slug: string, defaults: Partial<RawBookFrontmatter>) =>
  checkedMatter(
    indexMd, bookFrontmatterDefaults, extraBookMatter, slug, defaults,
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
      unlockChaptersOnAnswers: (value) => !["none", "attempt", "correct"].includes(value)
        && `'unlockChaptersOnAnswers' must be one of 'none', 'attempt', or 'correct'`,
      env: (value) =>
        !(value !== null
          && typeof(value) === "object"
          && !Array.isArray(value)
          && [Object.prototype, null].includes(Object.getPrototypeOf(value))
          && Object.keys(value).every((key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key))
        ) && "'env' must be a plain mapping, and keys must be valid identifiers",
    }
  );

const chapterMatter = (chapterMd: string, slug: string, defaults: Partial<ChapterFrontmatter>) =>
  checkedMatter(chapterMd, chapterFrontmatterDefaults, {}, slug, defaults);

export interface RawChapterDef extends ChapterDefBase {
  mdxContent: string | null;
}

export type RawBookDef = {
  slug: string;
  frontmatter: RawBookFrontmatter;
  mdxContent: string;
  chapters: RawChapterDef[];
};

export const parseBook = async (
  pathParts: string[],
  prevBuild: Date,
  defaults: CollectedDefaults
): Promise<RawBookDef> => {
  const fullPath = pathParts.join("/");
  const bookFile = getMdFile(pathParts)!;
  const indexMd = fs.readFileSync(bookFile!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd, fullPath, defaultsFor(defaults, fullPath, "book"));
  const mdxContent = parseMd(content);

  const chapterPaths =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("/") ? path.posix.join(pathParts[0], _slug.slice(1))
      : _slug.startsWith(".") ? path.posix.join(...pathParts, _slug)
      : /\.mdx?$/.test(_slug) ? path.posix.join(...pathParts, _slug)
      : path.posix.join(pathParts[0], "_chapters", _slug)
    ) ||
    readPublicDirMd(pathParts)
      .map((chapterPath) => path.posix.join(...pathParts, chapterPath))
      .sort();

  const chapters = [];
  // Defaults for chapters and questions are taken from the book's path, not the chapter's
  const chapterDefaults = defaultsFor(defaults, fullPath, "chapter");
  const questionDefaults = defaultsFor(defaults, fullPath, "question");
  for (const chapterPath of chapterPaths) {
    const errorPath = `${chapterPath} (in ${fullPath}):\n  `;
    if (!pathExists(chapterPath)) {
      logError(errorPath, `Chapter does not exist.`);
      continue;
    }

    if (fs.statSync(bookFile).mtime < prevBuild
        && fs.statSync(getMdFile(chapterPath)!).mtime < prevBuild) {
      chapters.push({
        chapterPath,
        mdxContent: null,
        questions: [],
        frontmatter: chapterFrontmatterDefaults});
      continue;
    }

    const index = catchErrorsSync(errorPath, () => getMdFile(chapterPath));
    if (!index) { continue; }

    const chapterMd = fs.readFileSync(index, "utf-8");
    const parsedMatter = catchErrorsSync(errorPath, () => chapterMatter(chapterMd, chapterPath, chapterDefaults));
    if (!parsedMatter) { continue; }

    const mdxContent = catchErrorsSync(errorPath, () => parseMd(parsedMatter.content));
    if (!mdxContent) { continue; }

    const questions = await catchErrors(errorPath, () => extractQuizzes(mdxContent, chapterPath, questionDefaults));
    if (!questions) { continue; }

    chapters.push({
      chapterPath,
      frontmatter: parsedMatter.frontmatter,
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
