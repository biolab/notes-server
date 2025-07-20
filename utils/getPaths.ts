import { getMdFile, isDirectory, readPublicDir } from "@/utils/helpers";

export const getPaths = (path: string[]): string[][] => {
  const indexFile = getMdFile(path);
  const collectionFile = getMdFile(path, "collection");
  if (indexFile && collectionFile) {
    throw new Error(
      `${path.join("/")} contains both index.md and collection.md`,
    );
  }
  return [
     ...indexFile || collectionFile ? [path] : [],
     ...indexFile ? [] : readPublicDir(...path)
        .filter((entry) => isDirectory(...path, entry) && entry !== "_chapters")
        .flatMap((entry) => getPaths([...path, entry]))];
}
