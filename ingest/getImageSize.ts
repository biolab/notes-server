import { Processor } from "unified";
import { visit } from "unist-util-visit";
import probe, { ProbeResult } from "probe-image-size";
import { readFileSync } from "fs";
import type { Node } from "unist";
import { basePath } from "@/ingest/paths";

interface ImgNode {
  tagName: "img";
  properties: {
    src: string;
    alt: string;
    height?: number;
    width?: number;
  };
}

export function getImageSize(this: Processor) {
  function imageNode(node: any): boolean {
    const img = node as ImgNode;
    return Boolean(
      img.tagName === "img" &&
        img.properties?.src &&
        !img.properties.src.startsWith("http")
    );
  }

  return async function transformer(tree: Node): Promise<Node> {
    const imageNodes: ImgNode[] = [];

    visit(tree, "element", (node: ImgNode) => {
      if (imageNode(node)) {
        imageNodes.push(node);
      }
    });

    for (const node of imageNodes) {
      let size: ProbeResult | null = null;

      const imgSrc = node.properties.src;

      try {
        const img = readFileSync(`${basePath}/${imgSrc}`);
        size = probe.sync(img);
      } catch (e) {
        console.log(e);
        console.log(`imgSrc: ${imgSrc}`);
        throw new Error(`Missing imgSrc: ${imgSrc}`);
      }

      if (size) {
        node.properties = {
          ...node.properties,
          src: `/img/notes${node.properties.src}`,
          width: size.width,
          height: size.height,
        };
      }
    }

    return tree;
  };
}
