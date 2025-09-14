import React, { JSXElementConstructor } from "react";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine } from "react-icons/ri";

import { UserDesc } from "@/api/quiz";
import { QuestionTypes } from "@/types";
import { corrColor, corrSym } from "@/utils/questions";
import { useIntl } from "@/i18n";
import { useLastAnswer } from "@/context/QuizContextProvider";


export interface QuizPropsBase {
  question: string;
  options?: string[];
  checker?: (option: string) => string | null;
  children?: Element;
}

export interface IQuestion extends QuizPropsBase {
  id: string;
  type: QuestionTypes;
  scorer: (option: string) => (boolean | undefined)
  bookId: number;
  maxPoints: number;
  maxTrials: number;
  usersAnswers?: (
    UserDesc &
    { answers: {
        answer: string;
        isCorrect?: boolean;
        points?: number;
      }[]
    }
  )[];
}

export default function Question({
  type,
  id,
  question,
  options = [],
  checker,
  scorer,
  maxPoints = 0,
  maxTrials = 1,
  children,
  usersAnswers,
}: IQuestion) {
  const [answer, setAnswer] = React.useState<null | string>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const { isCorrect, points, trials, answer: last, submissionErrored,
          answerQuestion } = useLastAnswer(id);
  React.useEffect(() => {
    if (last) {
      setSubmitted(true);
      setAnswer(last);
    }
  }, [last])
  const [formatError, setFormatError] = React.useState<null | string>(null);
  const { t } = useIntl();

  const submitDisabled = React.useMemo(
    () => maxTrials && trials >= maxTrials
          || !submissionErrored && isCorrect,
  [submissionErrored, isCorrect, maxTrials, trials]);

  const onSubmit = React.useCallback(
    async (e: React.MouseEvent, option: string ) => {
      e.preventDefault();
      if (submitDisabled || !option) {
        return;
      }

      const normalizedAnswer = option.trim().toLowerCase();
      const errored = checker ? checker(normalizedAnswer) : null;
      setAnswer(answer);
      setFormatError(errored);
      if (errored) {
        return;
      }

      const isCorrect = scorer(normalizedAnswer);
      const points = isCorrect ? maxPoints : 0;
      if (await answerQuestion({answer: option, isCorrect, points})) {
        setSubmitted(true);
      }
    },
    [submitDisabled, answer, checker, scorer, maxPoints, answerQuestion]
  );

  const message = React.useMemo(() => {
    if (submissionErrored) {
      return;
    }
    switch (isCorrect) {
      case null: {
        if (maxTrials > 1) {
          return `${t("quiz.attempts")}: ${maxTrials - trials}`;
        }
        return;
      }
      case false: {
        let msg = t("quiz.incorrect");
        if (trials < maxTrials && maxTrials > 1) {
          msg += ` ${t("quiz.remaining")}: ${maxTrials - trials}`
        }
        return msg;
      }
      case true: {
        let msg = t("quiz.correct");
        if (points) {
          msg += ` ${t("quiz.points")}: ${points}`;
        }
        return msg;
      }
      default:
        return null;
    }
  }, [t, submissionErrored, isCorrect, trials, maxTrials, points]);

  const correctnessClass = React.useMemo(() => {
    if (submissionErrored) {
      return "submission-errored";
    }
    switch (isCorrect) {
      case undefined: return "neutral";
      case true: return "correct";
      case false: return "incorrect";
      default: return ""
    }
  }, [submissionErrored, isCorrect]);

  const icon = React.useMemo(() =>
    submissionErrored ? <RiAlertLine />
    : type === "long-text" && submitted ? <RiCheckboxCircleFill />
    : isCorrect === true ? <RiCheckboxCircleFill />
    : isCorrect === false ? <RiCloseCircleLine />
    : null,
  [submissionErrored, isCorrect, submitted, type]);

  const childrenWithProps: any = React.Children.map(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as JSXElementConstructor<any>).name === "Explanation"
    ) {
      return React.cloneElement(child as React.ReactElement<any>, {
        ntrials: trials,
        maxTrialsUsed: !!(maxTrials && maxTrials === trials),
        isCorrect: !submissionErrored && isCorrect,
      });
    }
    return child;
  });

  const normalizedAnswer = React.useMemo(
    () => answer?.trim().toLowerCase(),
    [answer]);

  return <>
    <a id={`question-${id}`} />
      <div className={`quiz ${usersAnswers ? "" : correctnessClass}`}>
        <div className="quiz-question">
          <h3>
            {question} {!!maxPoints && <span>({maxPoints}pt.)</span>}
          </h3>
          {icon}
        </div>

        <form>
          <fieldset disabled={!!submitDisabled}>
            {type.includes("text") && (
              <>
                {type === "long-text" ? (
                  <textarea
                    value={answer || ""}
                    onChange={(e) => {
                      setSubmitted(false);
                      setAnswer(e.target.value);
                      setFormatError(null);
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={answer || ""}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setFormatError(null);
                    }}
                  />
                )}

                {(submissionErrored || !isCorrect) && (
                  <button
                    disabled={!answer}
                    onClick={(e) => onSubmit(e, answer as string)}
                  >
                    {t("quiz.submit-button")}
                  </button>
                )}
              </>
            )}

            {!!options?.length && (
              <div className="buttons-wrapper">
                {options.map((option) => (
                  <button
                    className={!usersAnswers && normalizedAnswer === option.toLowerCase() ? "selected ": ""}
                    onClick={(e) => onSubmit(e, option)}
                    key={option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          {!usersAnswers && message && <p className="quiz-message">{message}</p>}
          {submissionErrored &&
            <div
              className="bg-red-100 order-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
              role="alert"
            >
              <p>{t("quiz.submission-error")}</p>
            </div>
          }
          {formatError && <p className="error">{formatError}</p>}
          {!usersAnswers && childrenWithProps}
        </form>
        {usersAnswers && usersAnswers.length > 0 && (
          <div className="users-answers">
            {usersAnswers.map(({ name, surname, answers }, ui) => (
              <p key={ui}>
                {name} {surname}:&nbsp;
                {answers?.map(({answer, isCorrect}, i) => (
                  <React.Fragment key={i}>
                    { i > 0 && ", " }
                    <span style={{color: corrColor(isCorrect)}} key={i}>
                      {answer} {corrSym(isCorrect)}
                    </span>
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        )}
      </div>
  </>;
}
