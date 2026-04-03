import React, {JSX, useContext} from "react";
import {AnswerValueData, QuizContext} from "@/context/QuizContextProvider";
import { useIntl } from "@/i18n";

export const Quiz = ({title, children}: {
  title: string;
  children?: JSX.Element | JSX.Element[];
}) => {
  const parent = useContext(QuizContext);
  const { t } = useIntl();

  type PendingState = {[questionId: string]: AnswerValueData & {questionId: string}};
  type PendingAction =
    {type: "add", value: AnswerValueData & {questionId: string}}
    | { type: "remove", value: string};
  const [pendingAnswers, pendingAnswersReducer]
    : [PendingState, React.Dispatch<PendingAction>]
    = React.useReducer((state: PendingState, action: PendingAction) => {
      if (action.type == "add") {
        return {...state, [action.value.questionId]: action.value};
      }
      else {
        return Object.fromEntries(Object.entries(state).filter(([questionId]) => questionId !== action.value));
    }
  }, {});

  const answerQuestion = async (answer: AnswerValueData & {questionId: string}) => {
    pendingAnswersReducer({type: "add", value: answer});
    return true;
  }

  const displayedAnswer = React.useCallback(
    (id: string) => pendingAnswers[id]?.answer ?? parent.displayedAnswer(id),
    [pendingAnswers, parent]
  );

  const submitAnswers = React.useCallback(async () =>
      (await Promise.all(Object.values(pendingAnswers).map(async (answer) => {
        const res = await parent.answerQuestion(answer);
        if (res) {
          pendingAnswersReducer({type: "remove", value: answer.questionId});
        }
        return res;
      }))).every(Boolean),
    [pendingAnswers, parent]);

    return (
    <QuizContext.Provider value={{...parent, batchSubmission: true, answerQuestion, displayedAnswer}}>
      <div className="quiz-section quiz">
        {title && <h2>{title}</h2>}
        {children}
        <button onClick={submitAnswers} disabled={Object.keys(pendingAnswers).length == 0}>
          { t("quiz.submit-all-button") }
        </button>
      </div>
    </QuizContext.Provider>
  );
}
