import fs from "fs";
import path from "path";

import { RawBookFrontmatter, CollectionFrontmatter,
  defaultCollectionFrontmatter, extraCollectionMatter
} from "@/types";

import { bookMatter } from "./book";
import { checkedMatter, getMdFile, isListOfStrings, parseMd } from "./md-helpers";
import { isDirectory, readPublicDir } from "./paths";


export type RawCollectionDef = {
  slug: string;
  frontmatter: CollectionFrontmatter;
  mdxContent: string;
  books: { slug: string; frontmatter: RawBookFrontmatter }[];
  collections: { slug: string; frontmatter: CollectionFrontmatter }[];
}

const collectionMatter = (indexMd: string, slug: string | null = null) =>
  checkedMatter(
    indexMd, defaultCollectionFrontmatter, extraCollectionMatter, slug,
    { admins: isListOfStrings }
  );

export const parseCollection = async (pathParts: string[]): Promise<RawCollectionDef> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts, "collection")!, "utf-8");
  const { frontmatter, content } = collectionMatter(indexMd, fullPath);
  const mdxContent = parseMd(content);

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
    mdxContent,
    books,
    collections,
    slug: pathParts.join("/"),
  };
};
