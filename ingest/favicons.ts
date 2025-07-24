import { basePath, isDirectory, joinedPath, pathExists, readPublicDir } from "@/ingest/paths";

export const getFaviconPaths = (prefix: string): string[] => [
    ...pathExists(prefix, "favicon.png")
       ? [joinedPath([prefix]).replace(new RegExp(`^\/?${basePath}\/?`), "")]
       : [],
    ...readPublicDir(prefix)
      .map((subdir) => `${prefix}/${subdir}`)
      .filter((path) => isDirectory(path))
      .flatMap(getFaviconPaths)
];
