import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { getMdFile } from "@/utils/helpers";
import { getBookProps } from "@/utils/getBookProps";
import { getCollectionProps } from "@/utils/getCollectionProps";
import { getPaths } from "@/utils/getPaths";
import { UserContextProvider } from "@/context/UserContextProvider";

const ignoreLogin = process && process.env.NEXT_PUBLIC_IGNORE_LOGIN === "true";

export type PathList = { path: string[] };

export const generateStaticParams = async (): Promise<{ params: PathList }[]> =>
  getPaths([]).map((path) => ({ params: { path } }));

export async function generateMetadata({
  params,
}: {
  params: Promise<PathList>;
}) {
  const path = (await params).path ?? [];
  const isBook = !!getMdFile(path);
  const props = isBook
    ? await getBookProps(path)
    : await getCollectionProps(path);
  return {
    title: props!.frontmatter.title,
    description: props!.frontmatter.description || "",
  };
}

export default async function CollectionOrBookPage({
  params,
}: {
  params: Promise<PathList>;
}) {
  const path = (await params).path ?? [];

  if (getMdFile(path)) {
    const props = await getBookProps(path);
    const requireEmail = !!props.frontmatter.requireLogin && !ignoreLogin;

    return (
      <UserContextProvider requireEmail={requireEmail}>
        <Book {...props} />;
      </UserContextProvider>
    );
  } else {
    const props = await getCollectionProps(path);

    return (
      <UserContextProvider>
        <Collection {...props} />
      </UserContextProvider>
    );
  }
}
