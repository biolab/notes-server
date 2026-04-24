import fs from "fs";
import path from "path";

import matter from "gray-matter";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeExpressiveCode from "rehype-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

import { addRelativePath, forbiddenComponents, rewriteQuestions, replacer, constructReplacer } from "./plugins";
import { getImageSize } from "./getImageSize";
import { isDirectory, joinedPath, readPublicDir } from "./paths";


export const getMdFile = (spath: string | string[], base = "index") => {
  const bpath = joinedPath(spath);
  // Don't be smart and call the above isDirectory function;
  // you'll add another `notesPath` to the path
  if (!fs.statSync(bpath).isDirectory()) {
    return null;
  }

  const fname = path.posix.join(bpath, `${base}.md`);
  const fnamex = path.posix.join(bpath, `${base}.mdx`);
  if (fs.existsSync(fname)) {
    if (fs.existsSync(fnamex)) {
      throw new Error(`Both ${fname} and ${fnamex} exist. Please remove one.`);
    } else {
      return fname;
    }
  }
  if (fs.existsSync(fnamex)) {
    return fnamex;
  }
  return null;
};

export const readPublicDirMd = (spath: string | string[], base = "index") => {
  const bpath = typeof spath == "string" ? [spath] : spath;
  return readPublicDir(...bpath).filter(
    (dir) => !!getMdFile([...bpath, dir], base),
  );
};

export const parseMd = (content: string) =>
  content
    .replaceAll(
      /<!!!\s+float-aside\s+!!!>([\s\S]*?)\n\s*\n/g,
      (_, paragraph) => `<Sidenote>
${paragraph}
</Sidenote>

`
    )
    .replaceAll(
      /<!!!(.*)!!!>/g,
      (_, styles) => `<div ${styles
                             .split(" ")
                             .filter(Boolean)
                             .map((x: string) => `data-${x.trim()}`)
                             .join(" ")}></div>`
    )
    .replaceAll("<\\!!!", "<!!!");

export function checkedMatter<T>(
  indexMd: string,
  defaultMatter: T,
  extraMatter: Record<string, unknown> = {},
  slug: string | null,
  typeCheckers: Record<string, (value: any) => string | boolean> = {},
): {
  frontmatter: T;
  content: string;
} {
  const { data, content } = matter(indexMd);
  if (Object.keys(data).length == 0 && content.trim().startsWith("#")) {
    const [first, ...rest] = content.split("\n");
    return {
      frontmatter: {
        ...defaultMatter,
        title: first.replace(/^[ #]+/, "") },
      content: rest.join("\n")
    }
  }

  const allowed = { ...defaultMatter, ...extraMatter };
  const errors = [
    allowed["title"] !== undefined && data["title"] === undefined ? "missing 'title'" : "",
    ...Object.entries(data)
      .map(([key, value]) =>
        !(key in allowed) ? `unexpected key '${key}'`
        : typeCheckers[key] ? typeCheckers[key](value)
        : typeof value !== typeof allowed[key]
          ? `invalid type for '${key}': expected ${typeof allowed[key]}, got ${typeof value}`
          : "")
      ]
      .filter(Boolean);
  if (errors.length) {
    throw new Error(
      `Invalid frontmatter${slug ? ` in ${slug}` : ""}:` +
      (errors.length === 1
       ? ` ${errors[0]}`
       : `\n${errors.map((e) => `- ${e}`).join("\n")}`));
  }

  const replacer = constructReplacer({language: data.language});
  if (data.title) {
    data.title = replacer(data.title);
  }
  if (data.subTitle) {
    data.subTitle = replacer(data.subTitle);
  }

  return {
    frontmatter: { ...defaultMatter, ...data } as T,
    content,
  };
}

export const isListOfStrings = (value: unknown) =>
  (!Array.isArray(value) || value.some((x) => typeof(x) !== "string"))
  && "'tokens' must be a list of strings (don't forget the leading dashes)"

const rehypeExpressiveCodeOptions = {
  plugins: [pluginCollapsibleSections()],
}

export const serializedContent = async (
  source: string, language: string, relativePath: string,
  forbidden: string[] = []
) => {
  const compiled = await compile(source, {
    outputFormat: 'function-body',
    providerImportSource: '@mdx-js/react',
    jsxImportSource: 'react',
    development: false,
    remarkPlugins: [
      remarkMath,
      replacer({ language }),
      forbiddenComponents({ forbidden })
    ],
    rehypePlugins: [
      rehypeKatex,
      addRelativePath( { relativePath }),
      getImageSize,
      rewriteQuestions,
      [rehypeExpressiveCode, rehypeExpressiveCodeOptions]
    ],
  });
  return compiled.value as string;
}

export const getPaths = (path: string[]): [string[], boolean][] => {
  const indexFile = getMdFile(path);
  const collectionFile = getMdFile(path, "collection");
  if (indexFile && collectionFile) {
    throw new Error(
      `${path.join("/")} contains both index.md and collection.md`,
    );
  }
  return [
    ...(indexFile || collectionFile ? [[path, !!indexFile]] : []) as [string[], boolean][],
    ...indexFile ? [] : readPublicDir(...path)
      .filter((entry) => isDirectory(...path, entry) && entry !== "_chapters")
      .flatMap((entry) => getPaths([...path, entry]))];
}
