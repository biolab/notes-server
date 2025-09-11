import React from "react";

import { QuizContext } from "@/context/QuizContextProvider";


export const QuizProgressBar = () => {
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

  if (!quizState) {
    return null;
  }

  return (
    <>
      <div
        className="quiz-progress-indicator-wrapper"
        style={{borderColor}}
        title={`Answered: ${answeredQuestions} / ${noOfQuestions}\n
Correct: ${correctAnswers} (${Math.round((correctAnswers / noOfQuestions) * 100)} %)\n
Required: ${Math.round(noOfQuestions * quizState.quizThreshold)}`}
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
  const {chapterStats} = React.useContext(QuizContext);
  const { noOfQuestions, answeredQuestions, correctAnswers, correctness, questionIds } =
    chapterStats(chapterIndex) || { noOfQuestions: 0, answeredQuestions: 0, correctness: [], correctAnswers: 0 };
  if (noOfQuestions === 0) {
    return null;
  }
  let title;
  if (noOfQuestions === 1) {
    if (correctAnswers) {
      title = "Your answer was correct.";
    }
    else if (answeredQuestions) {
      title = "Your answer was incorrect.";
    }
    else {
      title = "You have not answered this question yet.";
    }
  }
  else {
    if (correctAnswers && correctAnswers != answeredQuestions) {
      title = `${correctAnswers} correct and ${answeredQuestions - correctAnswers} wrong answer(s).`;
    }
    else if (correctAnswers) {
      title = `${correctAnswers} correct answer(s).`;
    }
    else if (answeredQuestions) {
      title = `${answeredQuestions} wrong answer(s).`;
    }
    else {
      title = "You have not answered any questions yet.";
    }
    if (answeredQuestions != noOfQuestions) {
      title += `\n${noOfQuestions - answeredQuestions} question(s) remaining.`;
    }
  }
  return (
    <svg viewBox="-1 -1 2 2" role="img">
      <title>{title}</title>
      {indicator(correctness, questionIds)}
</svg>
)
}
