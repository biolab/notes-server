import fs from "fs";
import path from "path";

import { serialize } from "next-mdx-remote/serialize";
import rehypeKatex from "rehype-katex";
import { MDXRemoteSerializeResult } from "next-mdx-remote";
import { Database } from "sqlite";

import {
  checkedMatter,
  getMdFile,
  isDirectory,
  parseMd,
  readPublicDir,
} from "./helpers";
import { replacer } from "./plugins";
import { getImageSize } from "./getImageSize";
import {
  BookFrontmatter,
  CollectionFrontmatter,
  defaultCollectionFrontmatter,
  extraCollectionMatter,
} from "@/types/types";
import { bookMatter } from "@/utils/getBookProps";

const showUnpublished = process && process.env.SHOW_UNPUBLISHED === "true";
const DB_FILE = path.join(process.cwd(), "db", "notes.sqlite");

export type CollectionProps = {
  books: { slug: string; frontmatter: BookFrontmatter }[];
  collections: { slug: string; frontmatter: CollectionFrontmatter }[];
  frontmatter: CollectionFrontmatter;
  content: MDXRemoteSerializeResult;
  slug: string;
};

const collectionMatter = (indexMd: string, slug: string) =>
  checkedMatter(
    indexMd,
    slug,
    defaultCollectionFrontmatter,
    extraCollectionMatter,
  );

export const getCollectionProps = async (pathParts: string[], db?: Database, buildId?: number): Promise<CollectionProps> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts, "collection")!, "utf-8");
  const { frontmatter, content } = collectionMatter(indexMd, fullPath);
  const local_replacer = replacer({ language: frontmatter.language });
  const { id: collectionId } = db ? await db.get(`
    INSERT INTO collections (path, title, lastBuildId)
    VALUES (?, ?, ?)
    ON CONFLICT DO UPDATE SET
        title = excluded.title,
        lastBuildId = excluded.lastBuildId
    RETURNING id
  `, [fullPath, frontmatter.title, buildId]) : { id: undefined };

  const mdxSource = await serialize(
    parseMd(content, path.join(path.sep, ...pathParts)),
    {
      mdxOptions: {
        remarkPlugins: [local_replacer],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    },
  );

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

  if (db) {
    await Promise.all(
        books.map(async ({slug, frontmatter}) => {
          const {id} = await db.get(`
                INSERT INTO books (path, title, lastBuildId)
                VALUES (?, ?, ?)
                ON CONFLICT DO UPDATE SET title       = excluded.title,
                                          lastBuildId = excluded.lastBuildId
                RETURNING id`,
              [slug, frontmatter.title, buildId]);
          await db.run(`
                INSERT INTO collections_books (collectionId, bookId, lastBuildId)
                VALUES (?, ?, ?)
                ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId`,
              [collectionId, id, buildId]);
        })
    );

    await Promise.all(
        collections.map(async ({slug, frontmatter}) => {
          const {id} = await db.get(`
                INSERT INTO collections (path, title, lastBuildId)
                VALUES (?, ?, ?)
                ON CONFLICT DO UPDATE SET title       = excluded.title,
                                          lastBuildId = excluded.lastBuildId
                RETURNING id`,
              [slug, frontmatter.title, buildId]);
          await db.run(`
                INSERT INTO collections_collections (collectionId, subCollectionId, lastBuildId)
                VALUES (?, ?, ?)
                ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId`,
              [collectionId, id, buildId]);
        })
    );
  }

  return {
    frontmatter,
    content: mdxSource,
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
