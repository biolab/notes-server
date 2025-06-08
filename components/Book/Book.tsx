"use client";

import React, { useState } from "react";
import Image from "../Image";
import { MdxContent } from "../MdxContent";

import { Chapter } from "./Chapter";
import { ContentIndexControl } from "./ContentIndex";
import { IntlContextProvider } from "@/i18n";
import { BookProps } from "@/utils/getBookProps";
import Layout from "../layout";

export const Book = ({ frontmatter, content, chapters, slug }: BookProps) => {
  const [isChapterIndexVisible, setIsChapterIndexVisible] = useState({});
  const relativePath = React.useMemo(() => `/${slug}`, [slug]);
  const chapterNumbers = React.useMemo(() => Object.fromEntries(
    Array.from(chapters.entries())
      .filter(([, chapter]) => !chapter.frontmatter.omitAsChapter)
      .map(([index], i) => [index, i + 1])
  ), [chapters]);
  return (
    <IntlContextProvider lang={frontmatter.language || "en"}>
      <Layout
        title={frontmatter.title}
        showHome={!frontmatter.tocInHeader}
        chapters={frontmatter.tocInHeader ? chapters : []}
        isChapterIndexVisible={
          frontmatter.tocInHeader ? isChapterIndexVisible : []
        }
      >
        <div className="prose mx-auto book">
          {frontmatter.coverImg && (
            <div className="book-cover-img">
              <Image
                width={650}
                height={650}
                layout={"responsive"}
                alt={"cover image"}
                src={`${relativePath}/${frontmatter.coverImg}`}
              />
            </div>
          )}

          <h1 className="max-w-sm mb-0 font-medium">
            {frontmatter.title}
          </h1>
          <p className="subtitle">
            {frontmatter.subTitle}
          </p>

          <MdxContent content={content} />

          {!frontmatter.tocInHeader && (
            <ContentIndexControl
              chapters={chapters}
              isChapterIndexVisible={isChapterIndexVisible}
              startSmall={!!frontmatter.indexInitiallyClosed}
            />
          )}

          {chapters.map((chapterDef, index) => (
            <Chapter
              {...chapterDef}
              key={chapterDef.frontmatter.title}
              index={index}
              setIsChapterIndexVisible={setIsChapterIndexVisible}
              chapterNumber={chapterNumbers[index]}
            />
          ))}
        </div>
      </Layout>
    </IntlContextProvider>
  );
};
