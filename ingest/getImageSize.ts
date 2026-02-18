import { visit } from "unist-util-visit";
import probe, { ProbeResult } from "probe-image-size";
import { readFileSync } from "fs";
import type { Root } from "hast";

import { joinedPath } from "@/ingest/paths";


export const getImageSize = () => (tree: Root) => {
  visit(tree, "element", (node: any) => {
    if (
      node.tagName !== "img" ||
      !node.properties?.src ||
      /https?:\/\//.test(node.properties.src)
    ) {
      return;
    }

    const imgSrc = node.properties.src;
    let img: Buffer | undefined;
    let size: ProbeResult | undefined | null;

    try {
      img = readFileSync(joinedPath(imgSrc));
    } catch (e) {
      console.log(`Error reading file: ${imgSrc}`);
      throw e;
    }
    try {
      size = probe.sync(img);
    } catch {
      console.log(`Warning: ${imgSrc} may be unreadable`);
    }
    if (size) {
      node.properties.width = size.width;
      node.properties.height = size.height;
    }
  });
}
