import React, { JSX } from "react";
import * as runtime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';

import Image from "./Image";
import CcByNcNd from "./CcByNcNd";
import Question, { QuizPropsBase } from "./Quiz/Quiz";
import { Explanation, IExplanation } from "@/components/Quiz/Explanation";

import { determineQuestionType } from "@/utils/questions";
import { AnswersInBook } from "@/api/QuizService";


export interface QuestionProps extends QuizPropsBase {
  id?: string;
  longtext?: boolean;
  ungraded?: boolean;
  scorer?: (option: string) => (boolean | undefined);
  answer?: string;
  points?: number;
  trials?: number;
}

const CorrectAnswerPrefix = "*";

export const MdxContent = ({
  content,
  chapterId,
  bookId,
  t,
  allAnswers
}: {
  content: string;
  bookId?: number;
  chapterId?: number;
  t: (key: string) => string;
  allAnswers?: AnswersInBook;
}) => {
  if  (!content) {
    return;
  }

  const components = {
    Question: (props: QuestionProps) => {
      if (chapterId === undefined || bookId === undefined) {
        throw new Error("Questions can appear only in chapters");
      }
      const { answer, scorer, options, ungraded,
              longtext, points, trials, id, question,
              ...restProps } = props;

      const actAnswer =
        (answer
         || options
          ?.find((opt) => opt.startsWith(CorrectAnswerPrefix))
          ?.slice(CorrectAnswerPrefix.length)
         || undefined)
         ?.trim()
          .toLowerCase()

      const actOptions = options?.map(
        (opt) => opt.startsWith(CorrectAnswerPrefix)
                 ? opt.slice(CorrectAnswerPrefix.length).trim()
                 : opt);

      const type = determineQuestionType({options, longtext});
      const actScorer = scorer || (
        ungraded || points === 0 || actAnswer === undefined
        ? () => undefined
        : (x: string) => x === actAnswer);

      const usersAnswers = allAnswers
        ?.map(({answers, ...rest}) => (
          {...rest, answers: answers[id || question]}))
        .filter(({answers}) => answers && answers.length > 0);

      return (
        <Question
          {...restProps}
          question={question}
          id={id || question}
          bookId={bookId!}
          type={type}
          scorer={actScorer}
          options={actOptions}
          maxPoints={ungraded ? 0 : (points ?? 1)}
          maxTrials={trials || 1}
          usersAnswers={usersAnswers}
        />
      );
    },

    Explanation: (props: IExplanation) => <Explanation {...props} />,

    Sidenote: ({ children }: { children: React.ReactNode }) => (
      <div className="float-aside">{children}</div>
    ),

    ExpandingSideImg: (
      {src, alt, retina}: { src: string; alt?: string; retina?: boolean;
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

    QuizSection: ({title, children}: {
      title: string;
      children?: JSX.Element | JSX.Element[];
    }) =>
      <div className="quiz-section">
        {title && <h2>{title}</h2> }
        {children}
      </div>
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
