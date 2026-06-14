import {visit} from "unist-util-visit";
import type { Root } from "hast";
import { Expression, parseExpressionAt } from "acorn";

import dictJson from "@/i18n/dict";


const dict: Record<string, any> = dictJson;

const replacements = {
    " -- ": " — ",
    " ...": " …"
};

export const constructReplacer = ({language, extra_replacements}: {language: string, extra_replacements?: [string, string][]}) =>
  (s: string) => Object.entries({...replacements,
    ...(dict[language]?.["text-replacements"] || {}),
    ...(extra_replacements || {})})
    .map(([k, v]) => [k.startsWith("/") && k.endsWith("/") ? new RegExp(k.slice(1, -1), "g") : k, v] as [RegExp | string, string])
    .reduce((value, repl) => value.replaceAll(...repl), s);

export const replacer = ({language, extra_replacements}: {language: string, extra_replacements?: [string, string][]}) => () => (tree: any) => {
  const rep = constructReplacer({language, extra_replacements});
  visit(tree, 'text', textNode => {
    textNode.value = rep(textNode.value);
  });
}


export const addRelativeDir = ({relativeDir}: {relativeDir: string}) => () => (tree: Root) => {
  const publisher = relativeDir.split("/")[0];
  const pubStart = `/${publisher}/`;
  const updatedLink = (url: string) =>
    /https?:\/\//.test(url) || url.startsWith(pubStart) || url[0] === "#" ? url
    : url.startsWith("//") ? url.slice(1)
    : url.startsWith("/") ? `/${publisher}${url}`
    : `/${relativeDir}/${url}`;

  visit(
    tree,
    (node: any) => ["element", "mdxJsxFlowElement", "mdxJsxTextElement"].includes(node.type),
    (node: any) => {
      if (!relativeDir) {
        return;
      }
      if (node.type === "element") {
        // `src` can be undefined or mdxJsxAttributeValueExpression (which we don't touch)
        if (typeof node.properties?.src === "string") {
          node.properties.src = updatedLink(node.properties.src);
        }
        if (typeof node.properties?.href === "string") {
          node.properties.href = updatedLink(node.properties.href);
        }
      }
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        node.attributes?.forEach((attr: any) => {
          if ((attr.name === "src" || attr.name === "href")
              && typeof attr.value === "string") {
            attr.value = updatedLink(attr.value);
          }
        });
      }
    }
  );
}

export const forbiddenComponents = ({forbidden}: {
  forbidden: string[];
}) => {
  return () => (tree: Root) => {
    visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
      if (forbidden.includes(node.name)) {
        throw new Error(`<${node.name}> component is invalid here (or everywhere).`);
      }
    });
  };
};

export const rewriteQuestions = () => (tree: Root) => {
  visit(tree, "mdxJsxFlowElement", (node: any) => {
    if (node.name == "Explanation") {
      node.attributes = node.attributes
        .map((attr: { name: string, value: any }) => {
          if (attr.name === "after") {
            if (attr.value === "correctOrMaxTrials") {
              return {...attr, value: "done"};
            }
            // While we're here, we might as well validate the value
            if (!["attempt", "correct", "done"].includes(attr.value)
            ) {
              throw new Error(
                "invalid value for `after`; allowed values are null, 'attempt', 'correct' and 'done'"
              );
            }
          }
          return attr;
        });
    }
    else if (node.name == "Question") {
      node.attributes = node.attributes
        .filter((attr: { name: string }) => attr.name !== "answer")
        .map((attr: { name: string }) =>
          attr.name === "trials" ? {...attr, name: "attempts"} : attr
        );

      node.attributes.forEach((attr: { name: string, value: any }) => {
        if (attr.name !== "options"
          || attr.value?.type !== "mdxJsxAttributeValueExpression"
          ) {
          return;
        }
        let ast: Expression;
        try {
          ast = parseExpressionAt(attr.value.value, 0, {ecmaVersion: "latest"});
        } catch (e) {
          throw new Error(`Failed to parse options: ${attr.value.value}`);
        }
        if (ast.type !== "ArrayExpression") {
          throw new Error(`Invalid options array: ${attr.value.value}`);
        }

        const cleaned = ast.elements.map((el: any) => {
          if (!el) return null;
          if (el.type === "Literal" && typeof el.value === "string") {
            return el.value.startsWith("*") ? el.value.slice(1).trim() : el.value;
          }
          throw new Error(`Unsupported element type in options: ${el.type}`);
        });

        attr.value.value = JSON.stringify(cleaned);
        const expr = parseExpressionAt(attr.value.value, 0, { ecmaVersion: "latest" });
        attr.value.data = attr.value.data = {
          estree: {
            type: "Program",
            sourceType: "module",
            body: [
              {
                type: "ExpressionStatement",
                expression: expr
              }
            ]
          }
        };
      });
    }
  });
};

/* Life's too short to try to convince expressive code
    to stop adding frames to terminal windows, so let's just remove them. */
export const removeTerminalFrames = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: any) => {
      if (!node.properties?.className) {
        return;
      }
      const className = node.properties.className
      if (Array.isArray(className)) {
        node.properties.className = className.filter(
          (c) => c !== 'is-terminal'
        );
      } else if (typeof className === 'string') {
        node.properties.className = className
          .split(' ')
          .filter((c) => c !== 'is-terminal')
          .join(' ')
      }
    })
  }
}

export const backtickRunScript = () =>
  (tree: Root, file: any) => {
    visit(tree, "mdxJsxFlowElement", (node) => {
      if (node.name !== "RunScript" && node.name !== "script") {
        return;
      }
      const start = node.children[0]?.position?.start?.offset;
      const end = node.children[node.children.length - 1]?.position?.end?.offset;
      if (start == null || end == null) {
        return;
      }
      const text = String(file.value).slice(start, end).trim();
      const code = text.startsWith("{`") && text.endsWith("`}")
       ?  text.slice(2, text.length - 2) : text;
      node.name = "RunScript";
      node.children = [];
      node.attributes = [{
        type: "mdxJsxAttribute",
        name: "code",
        value: code
      }];
    });
  }
