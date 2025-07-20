"use client";

import React from "react";
import slugify from "slugify";
import { MdxContent } from "../MdxContent";

import { useOnScreen } from "@/hooks/useOnScreen";
import { useIntl } from "@/i18n";
import { ChapterDef } from "@/types/types";

export const Chapter = ({
  frontmatter,
  content,
  index,
  setIsChapterIndexVisible,
  chapterNumber,
  questions,
  bookId,
}: ChapterDef & {
  index: number;
  setIsChapterIndexVisible: React.Dispatch<
    React.SetStateAction<{ [key: number]: boolean }>
  >;
  chapterNumber: number;
  bookId: number;
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(ref);
  const { t } = useIntl();

  React.useEffect(() => {
    setIsChapterIndexVisible((val) => ({ ...val, ...{ [index]: isVisible } }));
  }, [isVisible, setIsChapterIndexVisible, index]);

  const mdxContent = React.useMemo(() => {
    return (
      <MdxContent
        chapterIndex={index}
        content={content}
        dbQuestions={questions}
        bookId={bookId}
        t = {t}
      />
    );
  }, [t, bookId, content, index, questions]);

  return (
    <div ref={ref} className="flex-container">
      <div className="right-column">
        <div className="prose mx-auto mt-8 chapter">
          <h2 className="chapter-title" id={slugify(frontmatter.title)}>
            {chapterNumber && `${t("book.chapter")} ${chapterNumber}: `}
            {frontmatter.title}
          </h2>

          {mdxContent}
        </div>
      </div>
    </div>
  );
};
