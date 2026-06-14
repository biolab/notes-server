import { compile } from "@mdx-js/mdx";
import * as babelParser from "@babel/parser";
import * as t from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { QuestionDef } from "@/types";
import { logError } from "./errors";


import { determineQuestionType } from "@/utils/questions";
import {QuestionDefaults} from "@/ingest/md-helpers";

export const extractQuizzes = async (
  mdxContent: string,
  slug: string,
  defaults: QuestionDefaults
): Promise<QuestionDef[]> => {
  const questions: QuestionDef[] = [];
  if (!/<\s*Question[\s\/>]/.test(mdxContent)) {
    return questions;
  }
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
      ],
    }
  );
  const ast = babelParser.parse(`() => {${String(compiledMdx)}}`, {
    sourceType: "module",
    plugins: [],
  });

  let quiz: {attempts: number} | null = null;

  traverse(ast, {
    CallExpression: {
      enter(path: NodePath<t.CallExpression>) {
        const args = path.node.arguments;
        if (
          args.length > 1 &&
          t.isIdentifier(args[0]) &&
          (args[0].name === "Question" || args[0].name === "Quiz")
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
              if (!t.isNumericLiteral(prop.value) && !t.isDecimalLiteral(prop.value)) {
                logError(where, `Property "${name}" is not a number.`);
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

            const getPropArray = (where: string, name: string): string[] | null => {
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
                  logError(where, `"${name}" contains a non-string element in array`);
                  return null;
                }
                strings.push(el.value);
              }
              return strings;
            };

            if (args[0].name === "Quiz") {
              if (quiz) {
                logError(slug, "Quiz cannot be put inside another quiz");
                return;
              }
              const attempts = getNumProp(slug, "attempts") ?? 1;
              if (attempts !== 0 && attempts !== 1) {
                logError(slug, "Quiz attempts must be 0 or 1");
                return;
              }
              quiz = { attempts };
            }

            if (args[0].name === "Question") {
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
              const attemptsProp = getNumProp(where, "attempts") ?? getNumProp(where, "trials");
              const attempts =
                quiz?.attempts  // if this is quiz, use quiz attempts
                ?? attemptsProp  // if attempts are set for question, use them; we later ensure this is not a quiz
                ?? (quiz ? (defaults.attempts === 0 ? 0 : 1) : defaults.attempts);  // for quiz, limit defaults attempts to 1
              const ungradedProp = getBoolProp(where, "ungraded");
              const ungraded = ungradedProp ?? defaults.ungraded ?? false;
              const options = getPropArray(where, "options");
              const answer = getProp(where, "answer");
              const correctOptions = options
                ?.filter((opt) => opt.startsWith("* "))
                .map((opt) => opt.slice(2).trim());
              const hasAnswer = hasProp("answer") || correctOptions?.length;
              const hasScorer = hasProp("scorer");
              const longtext = getBoolProp(where, "longtext");
              const upload = getBoolProp(where, "upload");
              const uploads = getBoolProp(where, "uploads");
              const isUpload = upload || uploads;
              const acceptProp = getProp(where, "accept");
              const accept = acceptProp ?? defaults.accept;
              const type = determineQuestionType({options, longtext, upload, uploads});
              const newErrors: string[] = (
                [
                  [correctOptions && correctOptions.length > 1,
                    `Single choice question should have at most one correct options`
                  ],
                  [correctOptions?.length === 1 && answer && correctOptions[0] !== answer,
                    `Correct answer does not match the one marked as correct in options`
                  ],
                  [
                    options && answer &&
                    !options
                      .map((s) => s.toLocaleLowerCase())
                      .includes(answer.toLocaleLowerCase()),
                    `Correct answer is not listed in options`
                  ],
                  [longtext && options,
                    "longtext is incompatible with options"
                  ],
                  [isUpload && (longtext || options || answer || hasScorer),
                    "upload(s) is incompatible with longtext, options, answer and scorer"
                  ],
                  [isUpload && attemptsProp && attemptsProp > 1,
                    "Upload questions allow only single (attempts={1}) or unlimited (attempts={0}) attempts"
                  ],
                  [acceptProp && !isUpload,
                    "Accept is only meaningful with upload or uploads"
                  ],
                  [!hasAnswer && !hasScorer && !ungraded && !(longtext || isUpload),
                    `Mark question as ungraded or provide answer or scorer`
                  ],
                  [
                    hasAnswer && hasScorer,
                    `Provide either answer or scorer, not both`
                  ],
                  [ungraded && (points || hasAnswer || hasScorer),
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
                  [quiz && hasProp("attempts"),
                    "`attempts` must be set for entire quiz, not individual questions"
                  ],
                  [quiz && isUpload,
                    "Upload questions are not supported inside quizzes"
                  ]
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
                answer: isUpload ? (accept || null) : (correctOptions?.[0] || answer),
                maxAttempts: (isUpload && attempts !== 1) ? 0 : (attempts ?? 1),
                maxPoints: ungraded ? 0 : (points ?? defaults.points ?? 1),
              });
            }
          }
        }
      },
      exit(path: NodePath<t.CallExpression>) {
        const args = path.node.arguments;
        if (
          args.length > 1 &&
          t.isIdentifier(args[0]) &&
          args[0].name === "Quiz"
        ) {
          quiz = null;
        }
      }
    },
  });
  return questions;
};
