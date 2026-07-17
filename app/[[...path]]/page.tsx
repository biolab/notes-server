import React from "react";
import { notFound, redirect } from "next/navigation";

import { getRedirections } from "@/utils/redirections";
import { getBook } from "@/api/book";
import { getCollection } from "@/api/collection";
import { getCss, getItem, getMetadata } from "@/api/content";
import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { BookResults, CollectionResults } from "@/components/Quiz/Results";
import { UserContextProvider } from "@/context/UserContextProvider";
import { SidenoteProvider } from "@/components/Book/Sidenote";


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
  const { token: tokenParam, results: resultsParam } = (await searchParams) as ({
    token: string | string[] | undefined,
    results: boolean | undefined
  });
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  for (const [from, to] of await getRedirections()) {
    if (from === path || path.startsWith(from + "/")) {
      const destination = to + path.slice(from.length);
      redirect(destination);
    }
  }

  const results = resultsParam !== undefined;
  const item = await getItem(path);
  if (!item) {
    notFound();
  }
  const css = await getCss(path);
  if (item.type === "book") {
    const book = await getBook(item.id);
    return (
      <UserContextProvider token={token}>
        <SidenoteProvider>
          { results ? <BookResults {...book} /> :
            <>
              {css && <link rel="stylesheet" href={css} precedence="high"/> }
              <Book {...book} />
            </>
          }
        </SidenoteProvider>
      </UserContextProvider>
    );
  } else {
    const collection = await getCollection(item.id);
    return (
      <UserContextProvider token={token}>
        <SidenoteProvider>
          { results ? <CollectionResults {...collection} /> :
            <>
              {css && <link rel="stylesheet" href={css} precedence="high"/> }
              <Collection {...collection} />
            </>
          }
        </SidenoteProvider>
      </UserContextProvider>
    );
  }
}
