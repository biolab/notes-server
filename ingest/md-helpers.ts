import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import { replacer } from "@/ingest/plugins";
import rehypeKatex from "rehype-katex";
import { getImageSize } from "@/ingest/getImageSize";
import { isDirectory, joinedPath, readPublicDir } from "@/ingest/paths";

export const getMdFile = (spath: string | string[], base = "index") => {
  const bpath = joinedPath(spath);
  // Don't be smart and call the above isDirectory function;
  // you'll add another `basePath` to the path
  if (!fs.statSync(bpath).isDirectory()) {
    return null;
  }

  const fname = path.join(bpath, `${base}.md`);
  const fnamex = path.join(bpath, `${base}.mdx`);
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

export function parseMd(content: string, imgRelativePath: string = "") {
  content = addRelativePathToImages(content, imgRelativePath);

  const macroStart = "<!!!";
  const macroEnd = "!!!>";

  const startIndex = content.indexOf(macroStart);
  const endIndex = content.indexOf(macroEnd);

  if (startIndex === -1 || endIndex === -1) {
    return content;
  }

  const macro = content
    .substring(startIndex + macroStart.length, endIndex)
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => !s.includes(macroStart) && !s.includes(macroEnd))
    .filter(Boolean);

  const insert =
    `<div ${macro.map((m) => "data-" + m).join(" ")}></div>` + "\n";

  return parseMd(
    content.substring(0, startIndex) +
      insert +
      content.substring(endIndex + macroEnd.length),
  );
}

export function addRelativePathToImages(
  content: string,
  imgRelativePath: string,
): string {
  if (!imgRelativePath || !content) {
    return content;
  }

  // Add relative path IF img src does NOT start with 'http' OR '/'
  return content
    .replace(/src="(?!(http)|(\/))/g, `src="${imgRelativePath}/`)
    .replace(/\]\((?!(http)|(\/))/g, `](${imgRelativePath}/`);
}

export function checkedMatter<T>(
  indexMd: string,
  slug: string,
  defaultMatter: T,
  extraMatter: Record<string, unknown> = {},
): {
  frontmatter: T;
  content: string;
} {
  const { data, content } = matter(indexMd);
  const allowed = { ...defaultMatter, ...extraMatter };
  const errors = Object.entries(data)
    .map(([key, value]) =>
      !(key in allowed) ? `- unexpected key '${key}'`
      : typeof value !== typeof allowed[key]
        ? `- invalid type for '${key}': expected ${typeof allowed[key]}, got ${typeof value}`
        : "",
    )
    .filter(Boolean)
    .join("\n");
  if (errors) {
    throw new Error(`Invalid frontmatter for ${slug}:\n${errors}`);
  }
  return {
    frontmatter: { ...defaultMatter, ...data } as T,
    content,
  };
}

export const serializedContent = async (source: string, language: string) => {
  const compiled = await compile(source, {
    outputFormat: 'function-body',
    providerImportSource: '@mdx-js/react',
    jsxImportSource: 'react',
    development: false,
    remarkPlugins: [remarkMath, replacer({ language })],
    rehypePlugins: [rehypeKatex, getImageSize],
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