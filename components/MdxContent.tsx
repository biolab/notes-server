import React from "react";
import * as runtime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';

import Image from "./Image";
import CcByNcNd from "./CcByNcNd";
import Quiz, { IQuiz } from "./Quiz/Quiz";
import { QuestionDef } from "@/ingest/updatePaths";
import { Explanation, IExplanation } from "@/components/Quiz/Explanation";


export const MdxContent = ({
  content,
  chapterIndex,
  dbQuestions,
  bookId,
  t
}: {
  content: string;
  chapterIndex?: number;
  dbQuestions?: QuestionDef[];
  bookId?: number;
  t: (key: string) => string;
}) => {
  if  (!content) {
    return;
  }

  const components = {
    Quiz: (props: IQuiz) => {
      if (chapterIndex === undefined) {
        throw new Error("Introduction cannot contain questions");
      }

      return (
        <Quiz
          {...props}
          //chapterIndex={chapterIndex}
          showQuiz={true}
          bookId={bookId!}
          dbQuestions={dbQuestions!}
        />
      );
    },
    Explanation: (props: IExplanation) => <Explanation {...props} />,
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
          (s: string | null) => `${s?.split("?")[0]}?${Math.random()}`
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
        [embedId]
      ),
    CcByNcNd,
    QuizSection: () => <div>Quiz Section</div>,
  }

  const fn = new Function('mdx', content);
  const { default: Content } = fn({
    jsxs: runtime.jsxs,
    jsx: runtime.jsx,
    Fragment: runtime.Fragment,
    useMDXComponents: () => components,
  });
  return (
    <MDXProvider>
      <Content components={components}/>
    </MDXProvider>
  );
};
