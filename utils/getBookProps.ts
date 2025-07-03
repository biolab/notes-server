import fs from "fs";
import path from "path";

import { MDXRemoteSerializeResult } from "next-mdx-remote";

import {
  catchErrors,
  checkedMatter,
  getMdFile,
  logError,
  parseMd,
  pathExists,
  readPublicDirMd,
  serializedContent
} from "./helpers";

import {
  BookFrontmatter,
  ChapterDef, ChapterFrontmatter,
  defaultBookFrontmatter,
  defaultChapterFrontmatter,
  extraBookMatter,
} from "@/types/types";
import { extractQuizzes } from './preflight';


export type BookPropsBase = {
  frontmatter: BookFrontmatter;
  slug: string;
};


export type BookProps = BookPropsBase & {
  content: MDXRemoteSerializeResult;
  chapters: ChapterDef[];
};

export type RawBookProps = BookPropsBase & {
  rawContent: string;
  chapters: {
    chapterDir: string,
    frontmatter: ChapterFrontmatter,
    rawContent: string
  }[]
};

export const bookMatter = (indexMd: string, slug: string) =>
  checkedMatter(indexMd, slug, defaultBookFrontmatter, extraBookMatter);

export const chapterMatter = (chapterMd: string, slug: string) =>
  checkedMatter(chapterMd, slug, defaultChapterFrontmatter);


export const getRawBook = async (pathParts: string[]): Promise<RawBookProps> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd, fullPath);
  const rawContent = parseMd(content, path.join(path.sep, ...pathParts));

  const chapterDirs =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("//") ? _slug.slice(2)
      : _slug.startsWith("/") ? path.join(pathParts[0], _slug.slice(1))
      : _slug.startsWith("./") ? path.join(...pathParts, _slug.slice(2))
      : path.join(pathParts[0], "_chapters", _slug),
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

    const index = await catchErrors(chapterDir, async () => getMdFile(chapterDir));
    if (!index) {
      continue;
    }
    const chapterMd = fs.readFileSync(index, "utf-8");
    const { frontmatter, content } = chapterMatter(chapterMd, chapterDir);
    const rawContent = parseMd(content, "/" + chapterDir);
    chapters.push({
      chapterDir,
      frontmatter,
      rawContent
    });
  }
  return {
    frontmatter,
    rawContent,
    chapters,
    slug: pathParts.join("/"),
  };
};

export const getBookProps = async (pathParts: string[]): Promise<BookProps> =>
  getRawBook(pathParts).then(async ({rawContent, chapters, frontmatter, slug}) => ({
      frontmatter,
      slug,
      content: await serializedContent(rawContent, frontmatter.language),
      chapters: await Promise.all(chapters.map(async ({frontmatter: chapterFrontmatter, rawContent}) => ({
        frontmatter: chapterFrontmatter,
        content: await serializedContent(rawContent, frontmatter.language),
        questions: await extractQuizzes(rawContent, slug)
      })))
  }));
