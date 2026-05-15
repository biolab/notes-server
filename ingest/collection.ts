import fs from "fs";
import path from "path";

import { RawBookFrontmatter, CollectionFrontmatter,
  defaultCollectionFrontmatter, extraCollectionMatter
} from "@/types";

import { bookMatter } from "./book";
import { checkedMatter, CollectedDefaults, defaultsFor, getMdFile, isListOfStrings, parseMd } from "./md-helpers";
import { isDirectory, readPublicDir } from "./paths";


export type RawCollectionDef = {
  slug: string;
  frontmatter: CollectionFrontmatter;
  mdxContent: string;
  books: { slug: string; frontmatter: RawBookFrontmatter }[];
  collections: { slug: string; frontmatter: CollectionFrontmatter }[];
}

const collectionMatter = (indexMd: string, slug: string, defaults: Partial<CollectionFrontmatter>) =>
  checkedMatter(
    indexMd, defaultCollectionFrontmatter, extraCollectionMatter, slug, defaults,
    { admins: isListOfStrings }
  );

const DefaultCollectionContent = `# Notes`;

export const parseCollection = async (pathParts: string[], defaults: CollectedDefaults): Promise<RawCollectionDef> => {
  const fullPath = pathParts.join("/");
  const mdFile = getMdFile(pathParts, "collection");
  if (!mdFile && pathParts.length !== 0) {
    throw new Error(`Collection ${fullPath} does not have an index.md(x) file`);
  }
  const indexMd = mdFile !== null ? fs.readFileSync(mdFile, "utf-8") : DefaultCollectionContent;
  const { frontmatter, content } = collectionMatter(indexMd, fullPath, defaultsFor(defaults, fullPath, "collection"));
  const mdxContent = parseMd(content);

  const recursivePaths = (spath: string, type: string): string[] =>
    readPublicDir(spath)
      .filter((entry) => entry !== "_chapters")
      .map((entry) => path.posix.join(spath, entry))
      .filter((newPath) => isDirectory(newPath))
      .flatMap((newPath) =>
        getMdFile(newPath, type) ? newPath
        : !frontmatter.recursiveContent ||
          getMdFile(newPath, type === "index" ? "collection" : "index") ? []
        : recursivePaths(newPath, type),
      );

  const resolveManualPath = (spath: string) =>
    spath.startsWith("/") ? path.posix.join(pathParts[0], spath.slice(1))
    : path.posix.join(...pathParts, spath);

  const appendIndexName = (slug: string, base: string): [string, string] => {
    const indexName = getMdFile(slug, base);
    if (!indexName) {
      throw new Error(`File ${slug}/${base}.md(x) does not exist`);
    }
    return [slug, indexName];
  };

  const books = (
    frontmatter.books?.map(resolveManualPath) ||
    recursivePaths(path.posix.join(...pathParts), "index")
  )
    .map((slug: string) => appendIndexName(slug, "index"))
    .map(([slug, indexName]: [string, string]) => ({
      slug,
      frontmatter: bookMatter(fs.readFileSync(indexName, "utf-8"), slug,
        defaultsFor(defaults, slug, "book"))
        .frontmatter,
    }));

  const collections = (
    frontmatter.collections?.map(resolveManualPath) ||
    recursivePaths(path.posix.join(...pathParts), "collection")
  )
    .map((slug: string) => appendIndexName(slug, "collection"))
    .map(([slug, indexName]: [string, string]) => ({
      slug,
      frontmatter: collectionMatter(fs.readFileSync(indexName, "utf-8"), slug,
        defaultsFor(defaults, slug, "collection"))
        .frontmatter,
    }));

  return {
    frontmatter,
    mdxContent,
    books,
    collections,
    slug: pathParts.join("/"),
  };
};
