"use client";

import React from "react";
import { MdxRenderer } from "./MdxRenderer";
import Image from "./Image";
import { MDXRemoteSerializeResult } from "next-mdx-remote";

import { useIntl } from "@/i18n";
import CcByNcNd from "./CcByNcNd";

export const MdxContent = ({
  content,
}: {
  content: MDXRemoteSerializeResult;
  hideQuestions?: boolean;
  chapterIndex?: number;
  showQuiz?: boolean;
  chapterTitle?: string;
}) => {
  const { t } = useIntl();

  return (
    <MdxRenderer
      content={content}
      components={{
        Quiz: () => <div>Quiz</div>,
        Explanation: () => <div>Explanation</div>,
        Sidenote: ({ children }: { children: React.ReactNode }) => (
          <div className="float-aside">{children}</div>
        ),
        ExpandingSideImg: ({
          src,
          alt,
          retina,
        }: {
          src: string;
          alt?: string;
          retina?: boolean;
        }) => (
          <Image
            src={src}
            layout="fill"
            style={{ objectFit: "contain" }}
            alt={alt || "image"}
            className={"expanding-side-img" + (retina ? " retina" : "")}
          />
        ),
        ReplayImg: ({ src, alt }: { src: string; alt?: string }) => {
          const [_src, setSrc] = React.useState(src ? src + "?" : null);
          const replay = React.useCallback(() => {
            setSrc(
              (s: string | null) => `${s?.split("?")[0]}?${Math.random()}`,
            );
          }, []);

          if (!_src) {
            throw new Error("ReplayImg has missing src prop");
          }
          return (
            <>
              <Image className="replay-img" src={_src} alt={alt} />
              <a className="replay-img-button" onClick={replay}>
                {t("chapter.replay")}
              </a>
            </>
          );
        },
        YouTube: ({ embedId }: { embedId: string }) =>
          React.useMemo(
            () => (
              <div className="youtube-video">
                <iframe
                  width="853"
                  height="480"
                  src={`https://www.youtube.com/embed/${embedId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Embedded youtube"
                />
              </div>
            ),
            [embedId],
          ),
        CcByNcNd,
        QuizSection: () => <div>Quiz Section</div>,
      }}
    />
  );
};
