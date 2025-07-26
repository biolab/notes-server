import React from "react";
import * as runtime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';

import Image from "./Image";
import CcByNcNd from "./CcByNcNd";
import Question, { QuizPropsBase } from "./Quiz/Quiz";
import { Explanation, IExplanation } from "@/components/Quiz/Explanation";


export interface QuestionProps extends QuizPropsBase {
  neutralOptions?: string[];
  multichoice?: boolean;
  longtext?: boolean;
  optional?: boolean;
  scorer?: (option: string) => boolean;
  answer?: string;
  points?: number;
  trials?: number;
}

export const MdxContent = ({
  content,
  chapterId,
  bookId,
  t
}: {
  content: string;
  bookId?: number;
  chapterId?: number;
  t: (key: string) => string;
}) => {
  if  (!content) {
    return;
  }

  const components = {
    Question: (props: QuestionProps) => {
      if (chapterId === undefined || bookId === undefined) {
        throw new Error("Questions can appear only in chapters");
      }
      const { answer, scorer, options, neutralOptions, optional,
              multichoice, longtext, points, trials,
              ...restProps } = props;

      const type =
        multichoice ? "multichoice"
        : options || neutralOptions ? "singlechoice"
        : longtext ? "long-text" : "text";

      const actScorer = scorer || (
        optional ? () => undefined
        : (x: string) => {
          const normalized = x.trim().toLocaleLowerCase()
          return neutralOptions?.includes(normalized) ? undefined
            : normalized === answer!.trim().toLowerCase()
        });

      return (
        <Question
          {...restProps}
          bookId={bookId!}
          type={type}
          scorer={actScorer}
          options={(options || neutralOptions) && [...options || [], ...neutralOptions || []]}
          maxPoints={points || 0}
          maxTrials={trials || 1}
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
