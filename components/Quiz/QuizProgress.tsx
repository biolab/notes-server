import React from "react";
import { QuizContext } from "@/context/QuizContextProvider";

export default function QuizProgress() {
  const {
    noOfQuestions,
    availablePoints,
    achievedPoints,
    answeredMandatoryQuestions,
    isQuizComplete,
    quizState,
  } = React.useContext(QuizContext);

  if (!quizState) {
    return null;
  }

  return (
    <div className="quiz-progress">
      <p>
        This quiz consists of <b>{noOfQuestions} mandatory questions</b> where
        you can gather <b>{availablePoints} points</b>.
        <br />
        You will complete the quiz by answering all the questions and gathering
        at{" "}
        <b>
          least {Math.round(availablePoints * quizState.quizThreshold)} points
        </b>
        .
      </p>

      <p>
        <b>
          Answered: {answeredMandatoryQuestions} / {noOfQuestions}
        </b>
      </p>
      <p>
        <b>
          Achieved points: {achievedPoints} (
          {Math.round((achievedPoints / availablePoints) * 100)} %)
        </b>
      </p>

      {isQuizComplete && <p>Congratulations! You have completed the quiz.</p>}
    </div>
  );
}
