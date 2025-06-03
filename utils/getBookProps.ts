import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { parseMd } from "./helpers";
// import { replacer } from "./plugins";
import { serialize } from "next-mdx-remote/serialize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getImageSize } from "./getImageSize";

export const getBookProps = async (slug: string) => {
  const isMdx = fs.existsSync(path.join("public", "books", slug, "index.mdx"));

  const indexMd = fs.readFileSync(
    path.join("public", "books", slug, `index.${isMdx ? "mdx" : "md"}`),
    "utf-8"
  );

  const { data: frontmatter, content } = matter(indexMd);
  const mdxSource = await serialize(
    parseMd(content, path.join(path.sep, "books", slug)),
    {
      mdxOptions: {
        remarkPlugins: [
          // TODO: add replacer plugin here
          // replacer
        ],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    }
  );

  const chapters = [];

  for (const _slug of frontmatter.chapters || []) {
    let chapterMd;

    try {
      const isChapterMdx = fs.existsSync(`public/chapters/${_slug}/index.mdx`);

      chapterMd = fs.readFileSync(
        `public/chapters/${_slug}/index.${isChapterMdx ? "mdx" : "md"}`,
        "utf-8"
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new Error(`Chapter ${_slug} not found`);
    }

    const { data: frontmatter, content } = matter(chapterMd);
    const mdxSource = await serialize(parseMd(content, `/chapters/${_slug}`), {
      mdxOptions: {
        remarkPlugins: [
          remarkMath,
          // replacer
        ],
        rehypePlugins: [rehypeKatex, getImageSize],
      },
    });

    chapters.push({
      frontmatter,
      content: mdxSource,
    });
  }

  if ((frontmatter.chapters || []).length !== chapters.length) {
    throw new Error(
      "One or more chapters have an error, check console output for more details."
    );
  }

  return {
    frontmatter,
    content: mdxSource,
    chapters,
    slug,
  };
};
