import fs from "fs";
import path from "path";
import { serialize } from "next-mdx-remote/serialize";
import rehypeKatex from "rehype-katex";
import matter from "gray-matter";
import {getMdFile, isDirectory, parseMd, readPublicDir} from "./helpers";
import { replacer } from "./plugins";
import { getImageSize } from "./getImageSize";

const showUnpublished = process && process.env.SHOW_UNPUBLISHED === "true";

export const getCollectionProps = async (pathParts) => {
  const indexMd = fs.readFileSync(
    getMdFile(pathParts, "collection"),
    "utf-8");

  const { data: frontmatter, content } = matter(indexMd);
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

  const recursivePaths = (spath, type) =>
    readPublicDir(spath)
      .filter((entry) => entry !== "_chapters")
      .map((entry) => path.join(spath, entry))
      .filter((newPath) => isDirectory(newPath))
      .flatMap((newPath) =>
        getMdFile(newPath, type) ? newPath
        : (!frontmatter.recursiveContent
            || getMdFile(newPath, type === "index" ? "collection" : "index")) ? []
        : recursivePaths(newPath, type)
      );

  const resolveManualPath = (spath) =>
    spath.startsWith("//") ? spath.slice(2)
    : spath.startsWith("/") ? path.join(pathParts[0], spath.slice(1))
    : path.join(...pathParts, spath);

  const appendIndexName = (slug, base) => {
    const indexName = getMdFile(slug, base);
    if (!indexName) {
      throw new Error(`File ${slug}/${base}.md(x) does not exist`);
    }
    return [slug, indexName];
  }

  const books = (
    frontmatter.books?.map(resolveManualPath)
    || recursivePaths(path.join(...pathParts), "index")
  )
  .map((slug) => appendIndexName(slug, "index"))
  .map(([slug, indexName]) => (
    {slug,
       frontmatter: matter(fs.readFileSync(indexName, "utf-8")).data
    }
  ))
  .filter(({ frontmatter: bookfrontmatter }) =>
    showUnpublished
    || !!frontmatter.books
    || (bookfrontmatter.public ?? true));

  const collections = (
    frontmatter.collections?.map(resolveManualPath)
    || recursivePaths(path.join(...pathParts), "collection")
  )
  .map((slug) => appendIndexName(slug, "collection"))
  .map(([slug, indexName]) => (
    {slug,
     frontmatter: matter(fs.readFileSync(indexName, "utf-8")).data
    }
  ))
  .filter(({ frontmatter: frontmattercoll }) =>
    showUnpublished
    || !!frontmatter.collections
    || (frontmattercoll.public ?? true));

  return {
    props: {
      frontmatter,
      content: mdxSource,
      books,
      collections,
      slug: pathParts.join("/"),
    },
  };
};
