import { Book } from "@/components/Book/Book";
import { Collection } from "@/components/Collection/Collection";
import { getMdFile, isDirectory, readPublicDir } from "@/utils/helpers";
import { getBookProps } from "@/utils/getBookProps";
import { getCollectionProps } from "@/utils/getCollectionProps";

type PathList = { path: string[] };

export async function generateStaticParams() {
  const getPaths = (path: string[]): { params: PathList }[] =>
    readPublicDir(...path)
      .filter((entry) => isDirectory(...path, entry) && entry !== "_chapters")
      .flatMap((entry) => {
        const newPath = [...path, entry];
        const indexFile = getMdFile([...newPath]);
        const collectionFile = getMdFile([...newPath], "collection");
        if (indexFile && collectionFile) {
          throw new Error(
            `${newPath.join("/")} contains both index.md and collection.md`,
          );
        }
        return [
          ...(indexFile || collectionFile
            ? [{ params: { path: newPath } }]
            : []),
          ...(!indexFile ? getPaths(newPath) : []),
        ];
      });
  return getPaths([]);
}

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
    return <Book {...props} />;
  } else {
    const props = await getCollectionProps(path);
    return <Collection {...props} />;
  }
}
