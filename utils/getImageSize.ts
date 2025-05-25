import { Processor } from "unified";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";
import probe, { ProbeResult } from "probe-image-size";
import { readFileSync } from "fs";

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

  return async function transformer(tree: Node, file: VFile): Promise<Node> {
    const imageNodes: ImgNode[] = [];

    visit(tree, "element", (node: any) => {
      if (imageNode(node)) {
        imageNodes.push(node as ImgNode);
      }
    });

    for (let node of imageNodes) {
      let size: ProbeResult | null = null;

      const imgSrc = node.properties.src;

      try {
        const img = readFileSync(`public${imgSrc}`);
        size = probe.sync(img);
      } catch (e) {
        console.log(e);
        console.log(`imgSrc: ${imgSrc}`);
        throw new Error(`Missing imgSrc: ${imgSrc}`);
      }

      if (size) {
        node.properties = {
          ...node.properties,
          width: size.width,
          height: size.height,
        };
      }
    }

    imageNodes.forEach(async (node) => {});

    return tree;
  };
}
