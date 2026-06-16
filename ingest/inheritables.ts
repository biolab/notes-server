import { isDirectory, pathExists, readPublicDir } from "./paths";
import { InheritableResources, ResourceType, resources } from "@/types";

export const inheritableResourcesFromPath = (prefix: string): InheritableResources =>
  Object.entries(resources)
  .filter(([, {file}]) => pathExists(prefix, file))
  .map(([type, {db}]) => ({
    type: type as ResourceType,
    path: prefix,
    db
  }));

export const getInheritableResources = (prefix: string): InheritableResources => [
  ...inheritableResourcesFromPath(prefix),
  ...readPublicDir(prefix)
    .map((subdir) => `${prefix}/${subdir}`)
    .filter((path) => isDirectory(path))
    .flatMap(getInheritableResources)
];
