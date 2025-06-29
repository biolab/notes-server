import fs from "fs";
import path from "path";

import { MDXRemoteSerializeResult } from "next-mdx-remote";

import {
  checkedMatter,
  getMdFile,
  isDirectory,
  parseMd,
  readPublicDir, serializedContent,
} from "./helpers";
import {
  BookFrontmatter,
  CollectionFrontmatter,
  defaultCollectionFrontmatter,
  extraCollectionMatter,
} from "@/types/types";
import { bookMatter } from "@/utils/getBookProps";

const showUnpublished = process && process.env.SHOW_UNPUBLISHED === "true";

type CollectionPropsBase = {
  books: { slug: string; frontmatter: BookFrontmatter }[];
  collections: { slug: string; frontmatter: CollectionFrontmatter }[];
  frontmatter: CollectionFrontmatter;
  slug: string;
};

export type CollectionProps = CollectionPropsBase & {
  content: MDXRemoteSerializeResult;
}

export type RawCollectionProps = CollectionPropsBase & {
  rawContent: string;
}

const collectionMatter = (indexMd: string, slug: string) =>
  checkedMatter(
    indexMd,
    slug,
    defaultCollectionFrontmatter,
    extraCollectionMatter,
  );

export const getRawCollection = async (pathParts: string[]): Promise<RawCollectionProps> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts, "collection")!, "utf-8");
  const { frontmatter, content } = collectionMatter(indexMd, fullPath);
  const mdxSource = parseMd(content, path.join(path.sep, ...pathParts));

  const recursivePaths = (spath: string, type: string): string[] =>
    readPublicDir(spath)
      .filter((entry) => entry !== "_chapters")
      .map((entry) => path.join(spath, entry))
      .filter((newPath) => isDirectory(newPath))
      .flatMap((newPath) =>
        getMdFile(newPath, type) ? newPath
        : !frontmatter.recursiveContent ||
          getMdFile(newPath, type === "index" ? "collection" : "index") ? []
        : recursivePaths(newPath, type),
      );

  const resolveManualPath = (spath: string) =>
    spath.startsWith("//") ? spath.slice(2)
    : spath.startsWith("/") ? path.join(pathParts[0], spath.slice(1))
    : path.join(...pathParts, spath);

  const appendIndexName = (slug: string, base: string): [string, string] => {
    const indexName = getMdFile(slug, base);
    if (!indexName) {
      throw new Error(`File ${slug}/${base}.md(x) does not exist`);
    }
    return [slug, indexName];
  };

  const books = (
    frontmatter.books?.map(resolveManualPath) ||
    recursivePaths(path.join(...pathParts), "index")
  )
    .map((slug: string) => appendIndexName(slug, "index"))
    .map(([slug, indexName]: [string, string]) => ({
      slug,
      frontmatter: bookMatter(fs.readFileSync(indexName, "utf-8"), slug)
        .frontmatter,
    }));

  const collections = (
    frontmatter.collections?.map(resolveManualPath) ||
    recursivePaths(path.join(...pathParts), "collection")
  )
    .map((slug: string) => appendIndexName(slug, "collection"))
    .map(([slug, indexName]: [string, string]) => ({
      slug,
      frontmatter: collectionMatter(fs.readFileSync(indexName, "utf-8"), slug)
        .frontmatter,
    }));

  return {
    frontmatter,
    rawContent: mdxSource,
    books: books.filter(
        ({ frontmatter: bookfrontmatter }) =>
            showUnpublished ||
            !!frontmatter.books ||
            (bookfrontmatter.public ?? true),
    ),
    collections: collections.filter(
        ({ frontmatter: frontmattercoll }) =>
            showUnpublished ||
            !!frontmatter.collections ||
            (frontmattercoll.public ?? true),
    ),
    slug: pathParts.join("/"),
  };
};

export const getCollectionProps = async (pathParts: string[]): Promise<CollectionProps> => {
  const {rawContent, ...baseCollection} = await getRawCollection(pathParts);
  return {
    ...baseCollection,
    content: await serializedContent(rawContent, baseCollection.frontmatter.language)
  };
}
