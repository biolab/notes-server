import fs from "fs";
import path from "path";
import {getMdFile, isDirectory, readPublicDir, readPublicDirMd} from "./helpers";
import matter from "gray-matter";

export const publishers = readPublicDirMd([]);

export const getLibrary = async ({publisher: filtPubl, collection: filtColl, book: filtBook, condition}, readFrontmatter=true) =>
  publishers
    .filter((publisher) => !filtPubl || publisher === filtPubl)
    .flatMap((publisher) =>
      readPublicDir(publisher)  // md is not required here
        .filter((collection) => (!filtColl || collection === filtColl) && collection !== "_chapters")
        .flatMap((collection) => {
          const collectionPath = path.join(publisher, collection);
          return !isDirectory(collectionPath) ? []
            : getMdFile(collectionPath) /* This is a book outside of collection */
            ? [{
                publisher,
                collection: null,
                book: collection,
                slug: collectionPath,
                frontmatter: (readFrontmatter || !!condition) &&
                  matter(
                    fs.readFileSync(
                      getMdFile(collectionPath),
                      "utf-8"
                    )
                  ).data
              }]
            : readPublicDirMd(collectionPath)
              .filter((book) => (!filtBook || book === filtBook))
              .map((book) => ({
                publisher,
                collection: getMdFile(collectionPath, "collection") ? collection : null,
                book,
                slug: path.join(publisher, collection, book),
                frontmatter: (readFrontmatter || !!condition) &&
                  matter(
                    fs.readFileSync(
                      getMdFile([collectionPath, book]),
                      "utf-8"
                    )
                  ).data
              }))
        })
    ).filter(({frontmatter}) => !condition || condition(frontmatter));


export const getCollections = async ({publisher: filtPubl, condition}) =>
  publishers
    .filter((publisher) => !filtPubl || publisher === filtPubl)
    .flatMap((publisher) =>
       readPublicDirMd(publisher, "collection")
        .map((collection) => ({
          publisher,
          collection,
          slug: path.join(publisher, collection),
          frontmatter: matter(fs.readFileSync(getMdFile([publisher, collection], "collection"), "utf-8")).data
        }))
       .filter(({frontmatter}) => !condition || condition(frontmatter))
    );
