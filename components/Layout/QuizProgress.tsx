import React from "react";

import { QuizContext } from "@/context/QuizContextProvider";
import { useIntl } from "@/i18n";


export const QuizProgressBar = () => {
  const { t } = useIntl();
  const { correctAnswers, answeredQuestions, noOfQuestions, quizState } =
    React.useContext(QuizContext);

  const corrWidth = React.useMemo(() =>
    (correctAnswers / noOfQuestions) * 100,
  [correctAnswers, noOfQuestions]);

  const wrongWidth = React.useMemo(() =>
    ((answeredQuestions - correctAnswers) / noOfQuestions) * 100,
    [correctAnswers, answeredQuestions, noOfQuestions]);

  const borderColor = React.useMemo(() =>
      correctAnswers / noOfQuestions >= (quizState?.quizThreshold || 2)
      ? "green"
      : "black",
    [correctAnswers, noOfQuestions, quizState?.quizThreshold]);

  if (!quizState || noOfQuestions === 0) {
    return null;
  }

  return (
    <>
      <div
        className="quiz-progress-indicator-wrapper"
        style={{borderColor}}
        title={`${t("quiz-progress.answered")}: ${answeredQuestions} / ${noOfQuestions}\n
${t("quiz-progress.correct")}: ${correctAnswers} (${Math.round((correctAnswers / noOfQuestions) * 100)} %)\n
${t("quiz-progress.required")}: ${Math.round(noOfQuestions * quizState.quizThreshold)}`}
      >
        { wrongWidth &&
          <div
            className="quiz-progress-indicator-bar"
            style={{
              width: `${wrongWidth + corrWidth}%`,
              backgroundColor: "red" }}
          ></div>
        }
        { corrWidth &&
          <div
            className="quiz-progress-indicator-bar"
            style={{ width: `${Math.round(corrWidth)}%`,
                     backgroundColor: "green" }}
          ></div>
        }
        { quizState?.quizThreshold &&
          <div
            className="quiz-progress-indicator-bar-threshold-line"
            style={{ position: "relative", left: `${quizState.quizThreshold * 100}%` }}
          ></div>
        }
      </div>
    </>
  );
};


const EW = 0.06
const NW = 5 * EW;

const indicator = (correctness: (boolean | undefined | null)[],
                   questionLinks: string[] | undefined) => {
  const n = correctness.length;
  if (n === 0) {
    return null;
  }
  return <>
    {correctness.map((c, i) => {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.sin(angle);
      const y = -Math.cos(angle);
      return <g key={i}>
        {questionLinks &&
          <>
            <a href={`#question-${questionLinks[i]}`} className="snowflake-link">
              <path d={`M0 0L${1.5 * x} ${1.5 * y}`} strokeWidth={4 * NW} />
            </a>
            <path d={`M0 0L${x} ${y}`} strokeWidth={1.5 * NW} className="snowflake-link-indicator"
                  pointerEvents={"none"}/>
          </>
        }
        {c === null ?
         <path key={i} d={`M0 0L${x} ${y}`} stroke="#000" strokeWidth={EW} style={{pointerEvents: "none"}}/>
                    : <path d={`M0 0L${x * 0.7} ${y * 0.7}`} stroke={c === undefined ? "#000" : c ? "green" : "red"}
             strokeWidth={NW} strokeLinecap="round" style={{pointerEvents: "none"}}/>
        }
      </g>
    })}
  <circle cx={0} cy={0} r={0.2} fill="#000" stroke="#fff" strokeWidth={EW / 2}/>
    </>
}

export const QuizProgressIndicator = ({chapterIndex}: {
  chapterIndex: number;
  questionLink?: string
}) => {
  const { t } = useIntl();
  const {chapterStats} = React.useContext(QuizContext);
  const { noOfQuestions, answeredQuestions, correctAnswers, correctness, questionIds } =
    chapterStats(chapterIndex) || { noOfQuestions: 0, answeredQuestions: 0, correctness: [], correctAnswers: 0 };
  if (noOfQuestions === 0) {
    return null;
  }
  let title;
  if (noOfQuestions === 1) {
    if (correctAnswers) {
      title = t("quiz-progress.correct-single");
    }
    else if (answeredQuestions) {
      title = t("quiz-progress.wrong-single");
    }
    else {
      title = t("quiz-progress.no-answer-single") ;
    }
  }
  else {
    if (correctAnswers && correctAnswers != answeredQuestions) {
      title = t("quiz-progress.correct-wrong")(correctAnswers, answeredQuestions - correctAnswers);
    }
    else if (correctAnswers) {
      title = t("quiz-progress.correct-all")(correctAnswers);
    }
    else if (answeredQuestions) {
      title = t("quiz-progress.wrong-all")(answeredQuestions);
    }
    else {
      title = t("quiz-progress.no-answers");
    }
    if (answeredQuestions != noOfQuestions) {
      title += t("quiz-progress.remaining")(noOfQuestions - answeredQuestions);
    }
  }
  return (
    <svg viewBox="-1 -1 2 2" role="img">
      <title>{title}</title>
      {indicator(correctness, questionIds)}
</svg>
)
}
