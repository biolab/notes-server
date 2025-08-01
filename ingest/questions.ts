import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { compile } from "@mdx-js/mdx";
import * as babelParser from "@babel/parser";
import * as t from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import { getImageSize } from "@/ingest/getImageSize";
import { QuestionDef } from "@/types/types";
import { logError } from "@/ingest/errors";


import { determineQuestionType } from "@/utils/questions";
import { addRelativePath } from "@/ingest/plugins";

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
      remarkPlugins: [
        remarkMath
      ],
      rehypePlugins: [
        rehypeKatex,
        addRelativePath({ relativePath: slug }),
        getImageSize
      ],
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
        args[0].name === "Question"
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

          const hasProp = (name: string): boolean =>
            !!findProp(name);

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


          const questionId = getProp(where, "id") || question;
          const points = getNumProp(where, "points");
          const ungraded = getBoolProp(where, "ungraded") ?? false;
          const options = getPropArray(where, "options");
          const answer = getProp(where, "answer");
          const correctOptions = options
            ?.filter((opt) => opt.startsWith("* "))
            .map((opt) => opt.slice(2).trim());
          const hasAnswer = hasProp("answer") || correctOptions?.length;
          const hasScorer = hasProp("scorer");
          const longtext = getBoolProp(where, "longtext");
          const type = determineQuestionType({options, longtext})
          const newErrors: string[] = (
            [
              /* Add more as needed */
              [ correctOptions && correctOptions.length > 1,
                `Single choice question should have at most one correct options`
              ],
              [ correctOptions?.length === 1 && answer && correctOptions[0] !== answer,
                `Correct answer does not match the one marked as correct in options`
              ],
              [
                options && answer &&
                !options
                  .map((s) => s.toLocaleLowerCase())
                  .includes(answer.toLocaleLowerCase()),
                `Correct answer is not listed in options`
              ],
              [ longtext && options,
                "longtext is incompatible with options"
              ],
              [ !hasAnswer && !hasScorer && !ungraded && !longtext,
                `Mark question as ungraded or provide answer or scorer`
              ],
              [ ungraded && points && points > 0,
                `Ungraded questions should not have points`
              ],
              [
                hasAnswer && hasScorer,
                `Provide either answer or scorer, not both`
              ],
              [ ungraded && (points || hasAnswer || hasScorer),
                `Ungraded questions should not have points, answer or scorer`
              ],
              [
                options && options.length < 2,
                `Options should contain at least two items`
              ],
              [
                options && new Set(options).size != options.length,
                `Options are not unique`
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
            type,
            options,
            answer,
            points
          });
        }
      }
    },
  });
  return questions;
};

