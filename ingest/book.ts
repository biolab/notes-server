import fs from "fs";
import path from "path";

import { ChapterDefBase, ChapterFrontmatter,
         BookDefBase, BookFrontmatter } from "@/types/types";
import { pathExists } from "@/ingest/paths";
import { checkedMatter, getMdFile, parseMd, readPublicDirMd } from "./md-helpers";
import { catchErrors, logError } from "@/ingest/errors";
import { extractQuizzes } from "@/ingest/questions";

const chapterFrontmatterDefaults: ChapterFrontmatter = {
  title: "",
  omitAsChapter: false,
  date: "",
  /* TODO: Fix books and remove */
  comment: "",
};

const bookFrontmatterDefaults: BookFrontmatter = {
  title: "",
  subTitle: "",
  description: "",
  date: "",
  public: true,
  language: "en",
  tocInHeader: false,
  indexInitiallyClosed: false,
  coverImg: "",
  requireLogin: false,
} satisfies BookFrontmatter & Record<string, unknown>;

const extraBookMatter = {
  chapters: [] as string[],

  /* TODO: These are related to quizzes. I listed them here so that
       current books pass validation, but they should be moved to
       bookFrontmatterDefaults or removed if they're no longer necessary. */
  showQuizProgress: false,
  requireLogin: false,
  quizThreshold: 0,
  submitQuizText: "",
  loginSubtitle: "",
  email: {},

  // Unended properties
  quiz: false,
  logQuizzes: false,
} satisfies Record<string, unknown>;

export const bookMatter = (indexMd: string, slug: string) =>
  checkedMatter(indexMd, slug, bookFrontmatterDefaults, extraBookMatter);

const chapterMatter = (chapterMd: string, slug: string) =>
  checkedMatter(chapterMd, slug, chapterFrontmatterDefaults);

interface RawChapterDef extends ChapterDefBase {
  mdxContent: string;
}

export type RawBookDef = BookDefBase & {
  mdxContent: string;
  chapters: RawChapterDef[];
};

export const parseBook = async (pathParts: string[]): Promise<RawBookDef> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd, fullPath);
  const mdxContent = parseMd(content, path.join(path.sep, ...pathParts));

  const chapterDirs =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("//")
        ? _slug.slice(2)
        : _slug.startsWith("/")
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
    const mdxContent = parseMd(content, "/" + chapterDir);
    const questions = await extractQuizzes(mdxContent, chapterDir);
    chapters.push({
      chapterDir,
      frontmatter,
      mdxContent,
      questions,
    });
  }
  return {
    slug: pathParts.join("/"),
    frontmatter,
    mdxContent,
    chapters,
  };
};
