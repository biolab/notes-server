import fs from "fs";
import path from "path";

import { RawBookFrontmatter, ChapterDefBase, ChapterFrontmatter } from "@/types";

import { pathExists } from "./paths";
import { checkedMatter, getMdFile, isListOfStrings, parseMd, readPublicDirMd } from "./md-helpers";
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
  chapterBuilds: Record<string, Date>
): Promise<RawBookDef> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd);
  const mdxContent = parseMd(content);

  const chapterDirs =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("/")
        ? path.join(pathParts[0], _slug.slice(1))
        : _slug.startsWith(".")
        ? path.join(...pathParts, _slug)
        : path.join(pathParts[0], "_chapters", _slug)
    ) ||
    readPublicDirMd(pathParts)
      .map((chapterDir) => path.join(...pathParts, chapterDir))
      .sort();

  const chapters = [];
  for (const chapterDir of chapterDirs) {
    const errorPath = `${chapterDir} (in ${fullPath}):\n  `;
    if (!pathExists(chapterDir)) {
      logError(errorPath, `Chapter does not exist.`);
      continue;
    }

    if (chapterBuilds[chapterDir] !== undefined
        && fs.statSync(getMdFile(chapterDir)!).mtime < chapterBuilds[chapterDir]) {
      chapters.push({
        chapterDir,
        mdxContent: null,
        questions: [],
        frontmatter: chapterFrontmatterDefaults});
      continue;
    }

    const index = catchErrorsSync(errorPath, () => getMdFile(chapterDir));
    if (!index) { continue; }

    const chapterMd = fs.readFileSync(index, "utf-8");
    const parsedMatter = catchErrorsSync(errorPath, () => chapterMatter(chapterMd, chapterDir));
    if (!parsedMatter) { continue; }

    const mdxContent = catchErrorsSync(errorPath, () => parseMd(parsedMatter.content));
    if (!mdxContent) { continue; }

    const questions = await catchErrors(errorPath, () => extractQuizzes(mdxContent, chapterDir));
    if (!questions) { continue; }

    chapters.push({
      chapterDir,
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
