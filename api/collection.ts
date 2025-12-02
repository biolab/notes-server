"use server";

import { CollectionFrontmatter, LinkDesc } from "@/types";
import { getPublicLink, ItemDesc, GroupList } from "@/api/content";
import db from "@/utils/db";


const showUnpublished = process && process.env.SHOW_UNPUBLISHED === "true";

export type CollectionProps = {
  collectionId: number;
  slug: string;
  frontmatter: CollectionFrontmatter;
  content: string;
  books: ItemDesc[];
  collections: ItemDesc[];
}

export const getCollection = async (id: number): Promise<CollectionProps> => {
  const collection = await db.get(`SELECT * FROM collections WHERE id = ?`, [id]);
  const ifHidePrivate = (s: string) => showUnpublished ? "" : s;

  const books = await db.all(
    `SELECT books.id, books.path as slug, books.title, books.subtitle
     FROM collections_books coll_books
     LEFT JOIN books ON books.id = bookId
     WHERE collectionId = ?
     ${ifHidePrivate("AND (coll_books.explicit = 1 OR books.public = 1)")}
     ORDER BY position`,
    [id])

  const collections = await db.all(
    `SELECT coll.id, coll.path as slug, coll.title, coll.subtitle
     FROM collections_collections coll_coll
     LEFT JOIN collections coll ON coll.id = subCollectionId
     WHERE collectionId = ?
     ${ifHidePrivate("AND (coll_coll.explicit = 1 OR coll.public = 1)")}
     ORDER BY position`,
    [id]
  )

  return {
    collectionId: collection.id,
    slug: collection.path,
    frontmatter: {
      title: collection.title, subTitle: collection.subtitle,
      coverImg: collection.coverImg, language: collection.language,
      public: collection.public === 1, recursiveContent: collection.recursiveContent === 1,
    },
    content: collection.content,
    books,
    collections,
  };
}

export const getGroups = async (
  collectionId: number, withQuestions=false
): Promise<GroupList> =>
  (await db.all(
    `SELECT DISTINCT g.id, g.name
     FROM collections_books cb
     JOIN books_groups bg ON cb.bookId = bg.bookId
     JOIN groups g on g.id = bg.groupId
     ${withQuestions
       ? ` JOIN books_chapters bc ON bg.bookId = bc.bookId
          JOIN questions q ON bc.chapterId = q.chapterId`
       : ""}
     WHERE cb.collectionId = ?
     ORDER BY g.name
     `,
    [collectionId]
  )) as {id: number, name: string}[];

export const getCollectionsWithCollection = async (collectionId: number): Promise<ItemDesc[]> =>
  (await db.all(
    `SELECT collections.id, collections.path as slug, collections.title
     FROM collections
     JOIN collections_collections cb ON collections.id = cb.collectionId
     WHERE cb.subCollectionId = ? AND collections.public = 1
     `,
    [collectionId]
  )) as ItemDesc[];

export const getPublicCollection = async (collectionId: number): Promise<LinkDesc> =>
  getPublicLink(getCollectionsWithCollection(collectionId))
