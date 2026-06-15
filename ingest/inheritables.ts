import { isDirectory, pathExists, readPublicDir } from "./paths";


const resources = [
  {type: "favicon", file: "favicon.png"},
  {type: "css", file: "style.css"},
  {type: "defaults", file: "defaults.yml", db: false},
];

export type InheritableResources = {
    type: string,
    path: string,
    db?: boolean
}[];

export const inheritableResourcesFromPath = (prefix: string): InheritableResources =>
  resources
  .filter(({file}) => pathExists(prefix, file))
  .map(({type, db}) => ({
    type,
    path: prefix,
    db: db ?? true
  }));

export const getInheritableResources = (prefix: string): InheritableResources => [
  ...inheritableResourcesFromPath(prefix),
  ...readPublicDir(prefix)
    .map((subdir) => `${prefix}/${subdir}`)
    .filter((path) => isDirectory(path))
    .flatMap(getInheritableResources)
];
