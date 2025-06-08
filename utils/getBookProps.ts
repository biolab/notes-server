import fs from "fs";
import path from "path";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MDXRemoteSerializeResult } from "next-mdx-remote";

import { checkedMatter, getMdFile, parseMd, readPublicDirMd } from "./helpers";
import { replacer } from "./plugins";
import { serialize } from "next-mdx-remote/serialize";
import { getImageSize } from "./getImageSize";
import {Database} from "sqlite";

import { compile } from '@mdx-js/mdx';
import * as babelParser from '@babel/parser';
import * as t from '@babel/types';
import traverse, {NodePath} from '@babel/traverse';

import {
  BookFrontmatter,
  ChapterDef,
  defaultBookFrontmatter,
  defaultChapterFrontmatter,
  extraBookMatter,
} from "@/types/types";

const extractQuizzes = async (mdxSource: string): Promise<{ quizId: string; question: string }[] >=> {
  const compiledMdx = await compile(
      mdxSource.replace(/[^\x00-\x7F]/g, ""),
      {outputFormat: 'function-body',
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex, getImageSize]},
  );
  const ast = await babelParser.parse(`() => {${String(compiledMdx)}}`, {
    sourceType: 'module',
    plugins: [],
  });

  const quizzes: {quizId: string, question: string}[] = [];
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const args = path.node.arguments;
      if (args.length > 1 &&
          t.isIdentifier(args[0]) &&
          args[0].name === "Quiz") {
        const props = args[1];
        if (t.isObjectExpression(props)) {
          const getProp = (name: string): string | null => {
            const prop = props.properties.find((prop): prop is t.ObjectProperty =>
                t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === name
            );

            if (prop && t.isStringLiteral(prop.value)) {
              return prop.value.value;
            }

            return null;
          };
          quizzes.push({
            quizId: getProp("id") || '',
            question: getProp("question") || ''
          });
        }
      }
    },
  });
  return quizzes;
}

export type BookProps = {
  chapters: ChapterDef[];
  frontmatter: BookFrontmatter;
  content: MDXRemoteSerializeResult;
  slug: string;
};

export const bookMatter = (indexMd: string, slug: string) =>
  checkedMatter(indexMd, slug, defaultBookFrontmatter, extraBookMatter);

export const chapterMatter = (chapterMd: string, slug: string) =>
  checkedMatter(chapterMd, slug, defaultChapterFrontmatter);

export const getBookProps = async (pathParts: string[], db?: Database, buildId?: number): Promise<BookProps> => {
  const fullPath = pathParts.join("/");
  const indexMd = fs.readFileSync(getMdFile(pathParts)!, "utf-8");
  const { frontmatter, content } = bookMatter(indexMd, fullPath);
  const { id: bookId } = db
  ? await db.get(`
      INSERT INTO books (path, title, lastBuildId)
      VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
          title = excluded.title,
          lastBuildId = excluded.lastBuildId
      RETURNING id
    `, [fullPath, frontmatter.title, buildId])
  : { id: undefined };

  const local_replacer = replacer({ language: frontmatter.language });
  const mdxSource = await serialize(
    parseMd(content, path.join(path.sep, ...pathParts)),
    {
      mdxOptions: {
        remarkPlugins: [local_replacer],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    },
  );

  const chapterDirs =
    frontmatter.chapters?.map((_slug) =>
      _slug.startsWith("//") ? _slug.slice(2)
      : _slug.startsWith("/") ? path.join(pathParts[0], _slug.slice(1))
      : _slug.startsWith("./") ? path.join(...pathParts, _slug.slice(2))
      : path.join(pathParts[0], "_chapters", _slug),
    ) ||
    readPublicDirMd(pathParts)
      .map((chapterDir) => path.join(...pathParts, chapterDir))
      .sort();

  const chapters = [];
  for (const chapterDir of chapterDirs) {
    const index = getMdFile(chapterDir);
    if (!index) {
      throw new Error(
        `Chapter ${chapterDir} does not exist or has no index.md(x)`,
      );
    }
    const chapterMd = fs.readFileSync(index, "utf-8");
    const { frontmatter, content } = chapterMatter(chapterMd, chapterDir);
    const row = db && await db.get(`
      SELECT id FROM chapters
      WHERE path = ? AND lastBuildId = ?`,
        [chapterDir, buildId]);
    const chapterExists = !!row;

    const chapterId =
        chapterExists ? row && row.id
                      : db && (await db.get(`
        INSERT INTO chapters (path, title, lastBuildId)
        VALUES (?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          title = excluded.title,
          lastBuildId = excluded.lastBuildId
        RETURNING id`,
    [chapterDir, frontmatter.title, buildId])).id;

    if (db) {
      await db.run(`
        INSERT INTO books_chapters (bookId, chapterId, lastBuildId)
        VALUES (?, ?, ?)
        ON CONFLICT DO UPDATE SET lastBuildId = excluded.lastBuildId
      `, [bookId, chapterId, buildId]);
    }

    const mdxSource = parseMd(content, "/" + chapterDir);
    if (!chapterExists) {
      const quizzes = await extractQuizzes(mdxSource);
      const quizIds = quizzes.map(({quizId}) => quizId);
      const noIds = quizzes
          .filter(({quizId}) => !quizId)
          .map(({question}) => question);
      if (noIds.length) {
        throw new Error(`\nQuiz ID is missing in ${chapterDir}:\n${noIds.join("\n")}`);
      }
      const duplicateIds = quizIds.filter((quizId, index) => !!quizId && quizIds.indexOf(quizId) !== index);
      const duplicates = [...new Set(duplicateIds)];
      if (duplicates.length) {
        /* TODO: This should throw an exception! */
        console.log(`\nWARNING: Duplicate quiz IDs found in ${chapterDir}: ${duplicates.join(", ")}`);
      }
      if (db) {
        await Promise.all(
            quizzes.map(async ({quizId, question}) =>
                await db.run(`
                      INSERT INTO questions (chapterId, questionId, question, lastBuildId)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT DO NOTHING`,
                    [chapterId, quizId, question, buildId])
            )
        );
      }
    }
    const serializedMdxSource = await serialize(
        mdxSource, {
          mdxOptions: {
            remarkPlugins: [remarkMath, local_replacer],
            rehypePlugins: [rehypeKatex, getImageSize],
          },
        }
    );
    chapters.push({
      frontmatter,
      content: serializedMdxSource,
    });
  }

  if (chapterDirs.length !== chapters.length) {
    throw new Error(
      "One or more chapters have an error, check console output for more details.",
    );
  }

  return {
    frontmatter,
    content: mdxSource,
    chapters,
    slug: pathParts.join("/"),
  };
};
