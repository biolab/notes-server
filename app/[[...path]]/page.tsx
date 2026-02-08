import React from "react";
import { notFound, redirect } from "next/navigation";

import { getRedirections } from "@/utils/redirections";
import { getBook } from "@/api/book";
import { getCollection } from "@/api/collection";
import { getCss, getItem, getMetadata } from "@/api/content";
import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { BookResults, CollectionResults } from "@/components/Quiz/Results";


export type PathList = { path: string[] };

export const generateMetadata = async ({params, searchParams}:
  { params: Promise<PathList>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
) =>
  Object.keys(await searchParams).length
    ? null
    : await getMetadata(((await params).path ?? []).join("/"));

export default async function CollectionOrBookPage(
  {params, searchParams}:
  { params: Promise<PathList>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
) {
  const path = ((await params).path ?? []).join("/");

  for (const [from, to] of await getRedirections()) {
    if (from === path || path.startsWith(from + "/")) {
      const destination = to + path.slice(from.length);
      redirect(destination);
    }
  }

  const results = (await searchParams).results !== undefined;
  const item = await getItem(path);
  if (!item) {
    notFound();
  }
  const css = await getCss(path);
  if (item.type === "book") {
    const book = await getBook(item.id);
    return results
      ? <BookResults {...book} />
      : <>
          {css && <link rel="stylesheet" href={css} precedence="high"/> }
          <Book {...book} />
        </>;
    } else {
               const collection = await getCollection(item.id);
    return results
      ? <CollectionResults {...collection} />
      : <>
        {css && <link rel="stylesheet" href={css} precedence="high"/> }
        <Collection {...collection} />
      </>
  }
}
