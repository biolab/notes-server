"use client";

import React from "react";
import slugify from "slugify";

import { AnswersInBook } from "@/api/quiz";
import { ChapterDef } from "@/types";
import { useOnScreen } from "@/hooks/useOnScreen";
import { useIntl } from "@/i18n";

import { MdxContent } from "../MdxContent";


export const Chapter = ({
  frontmatter,
  content,
  index,
  setIsChapterIndexVisible,
  chapterNumber,
  env,
  bookId,
  chapterId,
  allAnswers,
}: ChapterDef & {
  index: number;
  setIsChapterIndexVisible: React.Dispatch<
    React.SetStateAction<{ [key: number]: boolean }>
  >;
  chapterNumber: number;
  env: Record<string, any>
  bookId: number;
  allAnswers?: AnswersInBook;
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
        content={content}
        bookId={bookId}
        chapterId={chapterId}
        t = {t}
        env={env}
        allAnswers={allAnswers}
      />
    );
  }, [t, bookId, chapterId, content, allAnswers]);

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
