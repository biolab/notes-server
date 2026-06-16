"use server";

import db from "@/utils/db";
import { LinkDesc, resources, ResourceType } from "@/types";

export type ItemDesc = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
}

export type ItemDef = {
  type: "book" | "collection";
  id: number;
  title: string;
}

export type GroupList = {id: number, name: string}[];

export const getItem = async (path: string): Promise<ItemDef | undefined> =>
  await db.get(`SELECT 'book' as type, id, title FROM books WHERE path = ?`, [path])
  || await db.get(`SELECT 'collection' as type, id, title FROM collections WHERE path = ?`, [path]);

export const getInheritable = async (path: string, type: ResourceType): Promise<string | undefined> => {
  const row = await db.get(`
    SELECT path
    FROM inheritables
    WHERE type = ? AND ? LIKE path || '%'
    ORDER BY LENGTH(path) DESC
    LIMIT 1;`, [type, path ? path + "/" : ""]);
  const {file} = resources[type];
  return row === undefined ? undefined
      : row.path ? `/${row.path}/${file}`
      : `/${file}`;
}

export const getCss = async (path: string): Promise<string | undefined> =>
  await getInheritable(path, "css");

export const getMetadata = async (path: string):
  Promise<{title?: string, description?: string, icons?: {icon: string}} | undefined> => {
  const item = await getItem(path);
  if (!item) {
    return;
  }
  const { title, description } = await db.get(`
    SELECT title, subtitle as description
    FROM ${item.type}s
    WHERE id = ?`, [item.id]);
  const icon = await getInheritable(path, "favicon");
    return {
    title, description,
    ...icon ? {icons: {icon}} : {}
  };
}

export const getPublicProvider = async (slug: string): Promise<LinkDesc> => {
  const provider = slug.split("/")[0];
  const row = await db.get(
    `SELECT public, title
     FROM collections
     WHERE path = ?`,
    [provider]
  );
  return row && {href: `/${provider}`, title: row.title};
}

export const getPublicLink = async (collections: Promise<ItemDesc[]>): Promise<LinkDesc> => {
  const itemDescs = await collections;
  if (!itemDescs || itemDescs.length !== 1 || !itemDescs[0].slug.includes("/")) {
    return false;
  }
  const {title, slug} = itemDescs[0];
  return {title, href: `/${slug}`};
}
