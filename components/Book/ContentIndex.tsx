"use client";

import React from "react";
import { ImShrink2, ImEnlarge2 } from "react-icons/im";
import Link from "next/link";
import slugify from "slugify";

import { useIntl } from "@/i18n";
import { ChapterDef } from "@/types/types";

interface ContentIndexProps {
  contentTitle?: string;
  chapters: ChapterDef[];
  isChapterIndexVisible: Record<number, boolean>;
  className?: string;
}

export const ContentIndex = ({
  chapters,
  isChapterIndexVisible,
  className,
  contentTitle,
}: ContentIndexProps) => {
  const highestVisibleIndex = React.useMemo(() => {
    let highestIndex = 0;

    Object.keys(isChapterIndexVisible).forEach((c) => {
      const chapterIndex = parseInt(c);
      if (isChapterIndexVisible[chapterIndex] && chapterIndex > highestIndex) {
        highestIndex = chapterIndex;
      }
    });

    return highestIndex;
  }, [isChapterIndexVisible]);

  return (
    <>
      <div className={`content ${className || ""}`}>
        {contentTitle && <h2>{contentTitle}</h2>}
        <ul>
          {chapters.map(({ frontmatter }, index) => (
            <li className="content-index-chapter" key={index}>
              <Link
                href={"#" + slugify(frontmatter.title)}
                className={highestVisibleIndex === index ? "active" : ""}
              >
                {frontmatter.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const ContentIndexControl = ({
  chapters,
  isChapterIndexVisible,
  startSmall,
}: {
  chapters: ChapterDef[];
  isChapterIndexVisible: { [index: number]: boolean };
  startSmall: boolean;
}) => {
  const [small, setSmall] = React.useState(startSmall);
  const { t } = useIntl();

  return (
    <div className={small ? "small content-index" : "content-index"}>
      <div className="toolbar">
        <button className="icon-button" onClick={() => setSmall(!small)}>
          {small ? <ImEnlarge2 /> : <ImShrink2 />}
        </button>
      </div>
      <ContentIndex
        contentTitle={t("book.chapters")}
        chapters={chapters}
        isChapterIndexVisible={isChapterIndexVisible}
      />
    </div>
  );
};
