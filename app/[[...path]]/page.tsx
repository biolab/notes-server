import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { getBook, getCollection, getItem, getMetadata } from "@/api/BookService";
import React from "react";
import { notFound } from "next/navigation";
import { BookResults, CollectionResults } from "@/components/Quiz/Results";

export type PathList = { path: string[] };

export const generateMetadata = async ({params, searchParams}:
  { params: Promise<PathList>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
) =>
  Object.keys(await searchParams).length ? null : await getMetadata(((await params).path ?? []).join("/"));

export default async function CollectionOrBookPage(
  {params, searchParams}:
  { params: Promise<PathList>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
) {

  const path = ((await params).path ?? []).join("/");
  const results = (await searchParams).results !== undefined;
  const item = await getItem(path);
  if (!item) {
    notFound();
  }
  if (item.type === "book") {
    const book = await getBook(item.id);
    return results
      ? <BookResults {...book} />
      : <Book {...book} />;
  } else {
    const collection = await getCollection(item.id);
    return results
      ? <CollectionResults {...collection} />
      : <Collection {...collection} />
  }
}
