import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { compile } from "@mdx-js/mdx";
import * as babelParser from "@babel/parser";
import * as t from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import { getImageSize } from "@/ingest/getImageSize";
import { QuestionDef, QuestionTypes } from "@/types/types";
import { logError } from "@/ingest/errors";

export const extractQuizzes = async (
  mdxContent: string,
  slug: string
): Promise<QuestionDef[]> => {
  const compiledMdx = await compile(
    // At some point I used mdxContent.replace(/[^\x00-\x7F]/g, "") to fix some problem.
    // Later it turned out it makes options non-unique (e.g. in `options={["Č", "Š", "Ž"]}`).
    // I removed it and it still works. I'm keeping the comment, just for the case.
    mdxContent,
    {
      outputFormat: "function-body",
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, getImageSize],
    }
  );
  const ast = babelParser.parse(`() => {${String(compiledMdx)}}`, {
    sourceType: "module",
    plugins: [],
  });

  const questions: QuestionDef[] = [];
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const args = path.node.arguments;
      if (
        args.length > 1 &&
        t.isIdentifier(args[0]) &&
        args[0].name === "Quiz"
      ) {
        const props = args[1];
        if (t.isObjectExpression(props)) {
          const findProp = (name: string): t.ObjectProperty | undefined =>
            props.properties.find(
              (prop): prop is t.ObjectProperty =>
                t.isObjectProperty(prop) &&
                t.isIdentifier(prop.key) &&
                prop.key.name === name
            );

          const getProp = (where: string, name: string): string | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isStringLiteral(prop.value)) {
              logError(where, `Property "${name}" is not a string`);
              return null;
            }
            return prop.value.value;
          };

          const getNumProp = (where: string, name: string): number | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (
              !(
                t.isNumericLiteral(prop.value) || t.isDecimalLiteral(prop.value)
              )
            ) {
              logError(
                where,
                `
                Property "${name}" is not a number.
                Value:
                ${JSON.stringify(prop.value)}`
              );
              return null;
            }

            if (t.isNumericLiteral(prop.value)) {
              return prop.value.value;
            }

            return parseInt(prop.value.value);
          };

          const getBoolProp = (where: string, name: string): boolean | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isBooleanLiteral(prop.value)) {
              logError(where, `Property "${name}" is not a boolean`);
              return null;
            }

            return prop.value.value;
          };

          const getPropArray = (
            where: string,
            name: string
          ): string[] | null => {
            const prop = findProp(name);
            if (!prop) {
              return null;
            }
            if (!t.isArrayExpression(prop.value)) {
              logError(where, `"${name}" is not an array`);
              return null;
            }
            const elements = prop.value.elements;
            const strings: string[] = [];
            for (const el of elements) {
              if (!t.isStringLiteral(el)) {
                logError(
                  where,
                  `"${name}" contains a non-string element in array`
                );
                return null;
              }
              if (!el.value.length) {
                console.log(el);
              }
              strings.push(el.value);
            }
            return strings;
          };

          const question = getProp(slug, "question");
          if (!question) {
            logError(slug, "Question text is missing");
            return;
          }
          const where = `${slug}:\n  ${question.slice(0, 50)}${
            question.length > 50 ? "(...)" : ""
          }`;

          const type = getProp(where, "type") || "multi";
          if (["multi", "text", "long-text", "choice"].indexOf(type) === -1) {
            logError(
              where,
              `Question type "${type}" is not supported. Use "multi", "text" or "long-text".`
            );
            return;
          }

          const questionId = getProp(where, "id") || question;
          const points = getNumProp(where, "points") || 0;
          const optional = getBoolProp(where, "optional") ?? false;
          const options = getPropArray(where, "options");
          const answer = getProp(where, "answer");
          const newErrors: string[] = (
            [
              /* Add more as needed */
              [
                options &&
                answer &&
                !options
                  .map((s) => s.toLocaleLowerCase())
                  .includes(answer.toLocaleLowerCase()),
                `Correct answer is not listed in options`,
              ],
              [
                options && new Set(options).size != options.length,
                `Options are not unique`,
              ],
              [
                options && type !== "multi" && type !== "choice",
                "Options are only allowed for multi-choice questions",
              ],
              [
                (type === "multi" || type === "choice") && !options,
                "Options are required for multi-choice questions",
              ],
            ] as [boolean, string][]
          )
            .filter(([cond]) => cond)
            .map(([, error]) => error);

          if (newErrors.length > 0) {
            newErrors.forEach((error) => logError(where, error));
          }
          // We add invalid questions so that they're not reported as missing.
          // Build will fail, so they won't be added to the database.
          questions.push({
            questionId,
            question,
            type: type as QuestionTypes,
            options,
            answer,
            points,
            optional,

            line: path.node.loc?.start.line || -1,
          });
        }
      }
    },
  });
  return questions;
};

