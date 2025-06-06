import fs from "fs";
import path from "path";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MDXRemoteSerializeResult } from "next-mdx-remote";

import { checkedMatter, getMdFile, parseMd, readPublicDirMd } from "./helpers";
import { replacer } from "./plugins";
import { serialize } from "next-mdx-remote/serialize";
import { getImageSize } from "./getImageSize";
import {
  BookFrontmatter,
  ChapterDef,
  defaultBookFrontmatter,
  defaultChapterFrontmatter,
  extraBookMatter,
} from "@/types/types";

export type BookProps = {
  chapters: ChapterDef[];
  frontmatter: BookFrontmatter;
  content: MDXRemoteSerializeResult;
  slug: string;
};

export const bookMatter = (indexMd: string, slug: string) =>
  checkedMatter(indexMd, slug, defaultBookFrontmatter, extraBookMatter);

export const chapterMatter = (chapterMd: string, slug: string) =>
  checkedMatter(chapterMd, slug, defaultChapterFrontmatter);

export const getBookProps = async (pathParts: string[]): Promise<BookProps> => {
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd, pathParts.join("/"));
  const local_replacer = replacer({ language: frontmatter.language });
  const mdxSource = await serialize(
    parseMd(content, path.join(path.sep, ...pathParts)),
    {
      mdxOptions: {
        remarkPlugins: [local_replacer],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    },
  );

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
    const index = getMdFile(chapterDir);
    if (!index) {
      throw new Error(
        `Chapter ${chapterDir} does not exist or has no index.md(x)`,
      );
    }
    const chapterMd = fs.readFileSync(index, "utf-8");
    const { frontmatter, content } = chapterMatter(chapterMd, chapterDir);
    const mdxSource = await serialize(parseMd(content, "/" + chapterDir), {
      mdxOptions: {
        remarkPlugins: [remarkMath, local_replacer],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    });

    chapters.push({
      frontmatter,
      content: mdxSource,
    });
  }

  if (chapterDirs.length !== chapters.length) {
    throw new Error(
      "One or more chapters have an error, check console output for more details.",
    );
  }

  return {
    frontmatter,
    content: mdxSource,
    chapters,
    slug: pathParts.join("/"),
  };
};
