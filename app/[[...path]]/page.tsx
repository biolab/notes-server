import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { UserContextProvider } from "@/context/UserContextProvider";
import { getBook, getCollection, getItem, getMetadata } from "@/api/BookService";
import React, {Suspense} from "react";
import { notFound } from "next/navigation";
import { Results } from "@/components/Quiz/Results";

const ignoreLogin = process && process.env.NEXT_PUBLIC_IGNORE_LOGIN === "true";

export type PathList = { path: string[] };

export const generateMetadata = async ({params, searchParams}:
  { params: Promise<PathList>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
) =>
  await searchParams ? null : getMetadata(((await params).path ?? []).join("/"));

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
    // TODO: move this code into `Book` (not trivial because it uses UserContextProvider)
    const book = await getBook(item.id);
    const requireEmail = book.frontmatter.requireLogin && !ignoreLogin;
    return (
      <Suspense>
        <UserContextProvider requireEmail={requireEmail}>
          { results
            ? <Results bookIds={[item.id]} />
            : <Book {...book} />
          }
        </UserContextProvider>
      </Suspense>
    );
  } else {
    const collection = await getCollection(item.id);
    return (
      <Suspense>
        <UserContextProvider>
          <Collection {...collection} />
        </UserContextProvider>
      </Suspense>
    );
  }
}
