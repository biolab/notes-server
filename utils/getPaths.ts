import { getMdFile, isDirectory, readPublicDir } from "@/utils/helpers";

export const getPaths = (path: string[]): string[][] =>
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
        ...(indexFile || collectionFile ? [newPath] : []),
        ...(!indexFile ? getPaths(newPath) : []),
      ];
    });
