import {visit} from "unist-util-visit";
import type { Root } from "hast";

import dictJson from "@/i18n/dict.json";


const dict: Record<string, any> = dictJson;

const replacements = {
    " -- ": " — ",
    " ...": " …"
};

export const replacer = ({language, extra_replacements}: {language: string, extra_replacements?: [string, string][]}) => () => (tree: any) => {
    const all_replacements =
      Object.entries({...replacements,
                      ...(dict[language]?.["text-replacements"] || {}),
                      ...(extra_replacements || {})})
      .map(([k, v]) => [k.startsWith("/") && k.endsWith("/") ? new RegExp(k.slice(1, -1), "g") : k, v]);
    visit(tree, 'text', textNode => {
        textNode.value = all_replacements.reduce(
            (value, repl) => value.replaceAll(...repl),
            textNode.value); })
}


export const addRelativePath = ({relativePath}: {relativePath: string}) => () => (tree: Root) => {
  visit(
    tree,
    (node: any) => ["element", "mdxJsxFlowElement"].includes(node.type),
    (node: any) => {
      if (!relativePath) {
        return;
      }
      if (node.type === "element"
          && node.properties?.src
          && !/https?:\/\//.test(node.properties.src)
      ) {
        node.properties.src = `/${relativePath}/${node.properties.src}`;
      }
      if (node.type === "mdxJsxFlowElement") {
        node.attributes.forEach((attr: {name: string, value: string}) => {
          if (attr.name === "src"
              && !/https?:\/\//.test(attr.value)) {
            attr.value = `/${relativePath}/${attr.value}`;
          }
        });
      }
    }
  );
}