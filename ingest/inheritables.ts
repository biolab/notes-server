import { getNotesPath, isDirectory, joinedPath, pathExists, readPublicDir } from "./paths";


const resources = [
  {type: "favicon", file: "favicon.png"},
  {type: "css", file: "style.css"}
];

export type InheritableResources = {
    type: string,
    path: string
}[];

export const getInheritableResources = (prefix: string): InheritableResources => [
  ...resources
    .filter(({file}) => pathExists(prefix, file))
    .map(({type}) => ({
      type,
      path: joinedPath([prefix]).replace(new RegExp(`^\/?${getNotesPath()}\/?`), "")
    })),
  ...readPublicDir(prefix)
    .map((subdir) => `${prefix}/${subdir}`)
    .filter((path) => isDirectory(path))
    .flatMap(getInheritableResources)
];
