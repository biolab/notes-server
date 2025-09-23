import React from "react";

import { QuizContext } from "@/context/QuizContextProvider";
import { useIntl } from "@/i18n";
import { CollectionStats } from "@/api/quiz";


export const QuizProgressBar = ({answered, correct, wrong, nQuestions, threshold}: CollectionStats) => {
  const { t } = useIntl();

  const ungraded = React.useMemo(
    () => answered - correct - wrong,
    [answered, correct, wrong]
  );

  const correctP = React.useMemo(
    () => Math.round((correct / nQuestions) * 100),
    [correct, nQuestions]);

  const ungradedP = React.useMemo(
    () => Math.round((ungraded / nQuestions) * 100),
    [ungraded, nQuestions]);

  const wrongP = React.useMemo(
    () => Math.round((wrong / nQuestions) * 100),
    [wrong, nQuestions]);

  const borderColor = React.useMemo(
    () => correct / nQuestions >= (threshold || 2) ? "green" : "black",
    [correct, nQuestions, threshold]);

  if (nQuestions === 0) {
    return null;
  }

  return (
    <>
      <div
        className="quiz-progress-indicator-wrapper"
        style={{borderColor}}
        title={`${t("quiz-progress.answered")}: ${answered} / ${nQuestions}
${t("quiz-progress.correct")}: ${correct} (${correctP} %)
${t("quiz-progress.wrong")}: ${wrong} (${wrongP} %)`
+ (ungraded > 0 ? `\n${t("quiz-progress.ungraded")}: ${ungraded} (${ungraded} %)` : "")
+ (threshold ? `\n${t("quiz-progress.required")}: ${Math.round(nQuestions * threshold)}` : "")}
      >
        { !!wrong &&
          <div
            className="quiz-progress-indicator-bar"
            style={{
              width: `${wrongP + correctP + ungradedP}%`,
              backgroundColor: "red" }}
          ></div>
        }
        { !!ungraded &&
          <div
            className="quiz-progress-indicator-bar"
            style={{
              width: `${correctP + ungradedP}%`,
              backgroundColor: "gray" }}
          ></div>
        }
        { !!correctP &&
          <div
            className="quiz-progress-indicator-bar"
            style={{ width: `${correctP}%`,
                     backgroundColor: "green" }}
          ></div>
        }
        { !!threshold &&
          <div
            className="quiz-progress-indicator-bar-threshold-line"
            style={{ position: "relative", left: `${threshold * 100}%` }}
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
  const { nQuestions, answered, correct, correctness, questionIds } =
    chapterStats(chapterIndex) || { nQuestions: 0, answered: 0, correctness: [], correct: 0 };
  if (nQuestions === 0) {
    return null;
  }
  let title;
  if (nQuestions === 1) {
    if (correct) {
      title = t("quiz-progress.correct-single");
    }
    else if (answered) {
      title = t("quiz-progress.wrong-single");
    }
    else {
      title = t("quiz-progress.no-answer-single") ;
    }
  }
  else {
    if (correct && correct != answered) {
      title = t("quiz-progress.correct-wrong")(correct, answered - correct);
    }
    else if (correct) {
      title = t("quiz-progress.correct-all")(correct);
    }
    else if (answered) {
      title = t("quiz-progress.wrong-all")(answered);
    }
    else {
      title = t("quiz-progress.no-answers");
    }
    if (answered != nQuestions) {
      title += t("quiz-progress.remaining")(nQuestions - answered);
    }
  }
  return (
    <svg viewBox="-1 -1 2 2" role="img">
      <title>{title}</title>
      {indicator(correctness, questionIds)}
</svg>
)
}
