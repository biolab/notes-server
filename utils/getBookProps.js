import fs from "fs";
import path from "path";
import matter from "gray-matter";
import {getMdFile, parseMd, readPublicDirMd} from "./helpers";
import { replacer } from "./plugins";
import { serialize } from "next-mdx-remote/serialize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getImageSize } from "./getImageSize";

export const getBookProps = async (pathParts) => {
  const indexMd = fs.readFileSync(getMdFile(pathParts), "utf-8");
  const { data: frontmatter, content } = matter(indexMd);
  const local_replacer = replacer({language: frontmatter.language});
  const mdxSource = await serialize(
    parseMd(content, path.join(path.sep, ...pathParts)),
    {
      mdxOptions: {
        remarkPlugins: [local_replacer],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    }
  );

  const chapterDirs =
    frontmatter.chapters?.map((_slug) => (
      _slug.startsWith("//") ? _slug.slice(2)
      : _slug.startsWith("/") ? path.join(pathParts[0], _slug.slice(1))
      : _slug.startsWith("./") ? path.join(...pathParts, _slug.slice(2))
      : path.join(pathParts[0], "_chapters", _slug))
    )
    || (
      readPublicDirMd(pathParts)
      .map((chapterDir) => path.join(...pathParts, chapterDir))
      .sort()
    );

  const chapters = [];
  for (const chapterDir of chapterDirs) {
    const index = getMdFile(chapterDir);
    if (!index) {
      throw new Error(`Chapter ${chapterDir} does not exist or has no index.md(x)`);
    }
    const chapterMd = fs.readFileSync(index);
    const { data: frontmatter, content } = matter(chapterMd);
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
      "One or more chapters have an error, check console output for more details."
    );
  }

  return {
    props: {
      frontmatter,
      content: mdxSource,
      chapters,
      slug: pathParts.join("/"),
    },
  };
};
