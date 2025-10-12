import {visit} from "unist-util-visit";
import type { Root } from "hast";
import { Expression, parseExpressionAt } from "acorn";

import dictJson from "@/i18n/dict";


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

export const forbiddenComponents = ({forbidden}: {
  forbidden: string[];
}) => {
  return () => (tree: Root) => {
    visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
      if (forbidden.includes(node.name)) {
        throw new Error(`<${node.name}> component is invalid here (or everywhere).`);
      }
      if (node.name == "Quiz") {
        throw new Error("Replace <Quiz> with <Question>." );
      }
    });
  };
};

export const rewriteQuestions = () => (tree: Root) => {
  visit(tree, ["mdxJsxFlowElement"], (node: any) => {
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
