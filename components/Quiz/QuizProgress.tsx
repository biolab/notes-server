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


function sectorPathD(p: number, radius = 1) {
  if (p > 1-1e-4) {
    return `
      M 0 0
      m 0 ${-radius}
      a ${radius} ${radius} 0 1 1 0 ${2 * radius}
      a ${radius} ${radius} 0 1 1 0 ${-2 * radius}
      Z
    `.replace(/\s+/g, " ");
  }

  const angle = p  * Math.PI * 2;
  const x1 = 0, y1 = -radius;
  const x2 = Math.sin(angle) * radius;
  const y2 = -Math.cos(angle) * radius;
  const large = angle > Math.PI ? 1 : 0;
  const sweep = 1;
  return `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} ${sweep} ${x2} ${y2} Z`;
}

export const QuizProgressCircle = ( { chapterIndex }: {chapterIndex: number }) => {
  const { chapterStats } = React.useContext(QuizContext);
  const { noOfQuestions, answeredQuestions, correctAnswers } =
    chapterStats(chapterIndex) || { noOfQuestions: 0, answeredQuestions: 0 };
  if (noOfQuestions === 0) {
    return null;
  }
  const p = answeredQuestions / noOfQuestions;
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
      <circle cx="0" cy="0" r="1" fill="#eee" stroke="#000" strokeWidth={0.03} style={{position: "absolute", right: "4px"}}/>
      {p > 0 && <path d={sectorPathD(p, 1)} fill="black
      " />}
</svg>
)
}
