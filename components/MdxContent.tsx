import React, { JSX } from "react";
import * as runtime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';

import { AnswersInBook } from "@/api/quiz";
import { determineQuestionType } from "@/utils/questions";
import { Explanation, IExplanation } from "@/components/Quiz/Explanation";

import Question, { QuizPropsBase } from "./Quiz/Question";
import { Quiz } from "@/components/Quiz/Quiz";
import Image from "./Image";
import { ExpandingSideImg, Sidenote } from "@/components/Book/Sidenote";
import { CodeTab, CodeTabs } from "@/components/Book/CodeTabs";


export interface QuestionProps extends QuizPropsBase {
  id?: string;
  longtext?: boolean;
  upload?: boolean;
  uploads?: boolean;
  accept?: string;
  ungraded?: boolean;
  scorer?: (option: string) => (boolean | undefined);
  points?: number;
  attempts?: number;
}

export const MdxContent = ({content, chapterId, bookId, t, env, allAnswers}: {
  content: string;
  bookId?: number;
  chapterId?: number;
  t: (key: string) => string;
  env?: Record<string, any>;
  allAnswers?: AnswersInBook;
}) => {
  React.useEffect(() => {
    const resize = (img: HTMLImageElement) => {
      // Set only maxHeight to avoid overriding maxWidth set to images in side columns
      img.style.maxHeight = `${img.naturalHeight / 2}px`;
    };

    const images = document.querySelectorAll<HTMLImageElement>("img.retina");
    images.forEach(img => {
      if (img.complete) {
        resize(img);
      }
      else {
        img.addEventListener("load", () => resize(img), {once: true});
      }
    });
  }, []);

  if  (!content) {
    return;
  }

  const components = {
    Question: (props: QuestionProps) => {
      if (chapterId === undefined || bookId === undefined) {
        throw new Error("Questions can appear only in chapters");
      }
      const { scorer, options, ungraded,
              longtext, upload, uploads, points, attempts, id, question,
              accept,
              ...restProps } = props;

      const type = determineQuestionType({options, longtext, upload, uploads});

      const usersAnswers = allAnswers
        ?.map(({answers, ...rest}) => (
          {...rest, answers: answers[id || question]}))
        .filter(({answers}) => answers && answers.length > 0);

      return (
        <Question
          {...restProps}
          question={question}
          id={id || question}
          type={type}
          scorer={scorer}
          options={options}
          usersAnswers={usersAnswers}
        />
      );
    },

    Explanation: (props: IExplanation) => <Explanation {...props} />,
    Quiz,

    Sidenote,
    SideNote: Sidenote,
    ExpandingSideImg,

    CodeTabs, CodeTab,

    FullWidth: ({ children }: { children: React.ReactNode }) =>
      <div className="full-width">
        {children}
      </div>,

    WidgetIframe: ({ src, width, height, className }: {
      src: string,
      width?: string,
      height?: string,
      className?: string
    }) => {
      const [show, setShow] = React.useState(false);
      React.useEffect(() => { setShow(true); }, []);
      return (
        <>
          {show && (
            <iframe
              className={`widget-iframe ${className ?? ""}`}
              allow="clipboard-write"
              width={width || "100%"}
              height={height || "900px"}
              src={src}
              style={{zoom: 0.9}}
            />
          )}
        </>
      );
    },

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

    CcByNcNd: () =>
      <img src="/icons/cc-by-nc-nd.png" alt="CC BY-NC-ND" /> /* eslint-disable-line @next/next/no-img-element */,

    QuizSection: ({title, children}: {
      title: string;
      children?: JSX.Element | JSX.Element[];
    }) =>
      <div className="quiz-section">
        {title && <h2>{title}</h2> }
        {children}
      </div>,

    RunScript: ({code}: {code: string}) => {
      React.useEffect(() => {
        if (window === undefined) {
          return;
        }
        try {
          eval(code);
        } catch (err) {
          console.error("RunScript error:", err);
        }
      }, [code])
      return null;
    },
  }

  const fn = new Function('mdx', 'env',
    (env ? `const { ${Object.keys(env).join(', ')} } = env;\n`: "")
    + content
  );
  const { default: Content } = fn({
    jsxs: runtime.jsxs,
    jsx: runtime.jsx,
    Fragment: runtime.Fragment,
    useMDXComponents: () => components,
  },
  env ?? {});
  return (
    <MDXProvider>
      <Content components={components}/>
    </MDXProvider>
  );
};
