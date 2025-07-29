import React, { JSXElementConstructor } from "react";
import { useTimer } from "use-timer";
import { useIntl } from "@/i18n";
import { useLastAnswer } from "@/context/QuizContextProvider";
import { QuestionTypes } from "@/types/types";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine, RiTimerLine } from "react-icons/ri";

export interface QuizPropsBase {
  question: string;
  options?: string[];
  checker?: (option: string) => string | null;
  timeout?: number;
  children?: Element;
}

export interface IQuestion extends QuizPropsBase {
  id: string;
  type: QuestionTypes;
  scorer: (option: string) => (boolean | undefined)
  bookId: number;
  maxPoints: number;
  maxTrials: number;
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
  timeout = 0,
  children,
}: IQuestion) {
  const [answer, setAnswer] = React.useState<null | string | string[]>(null);
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

  const { time: timeLeft, start: startTimer, status: timerStatus } =
    useTimer({ initialTime: timeout, endTime: 0, timerType: "DECREMENTAL" });
  const timeoutRunning = React.useMemo(
    () => timeout && timerStatus === "RUNNING" && timeLeft,
    [timerStatus, timeLeft, timeout]
  );

  const submitDisabled = React.useMemo(
    () => maxTrials && trials >= maxTrials
          || timeoutRunning
          || !submissionErrored && isCorrect,
  [submissionErrored, isCorrect, timeoutRunning, maxTrials, trials]);

  const onSubmit = React.useCallback(
    async (e: React.MouseEvent, option: string ) => {
      e.preventDefault();
      if (submitDisabled || !option) {
        return;
      }

      const _answer = answerFromOption(option, answer!, type);
      const _normalizedAnswer = getNormalizedAnswer(_answer);
      const errored = checker ? checker(_normalizedAnswer as string) : null;
      setAnswer(_answer);
      setFormatError(errored);
      if (errored) {
        return;
      }

      const isCorrect = scorer(_normalizedAnswer as string);
      if (!await answerQuestion({
        isCorrect,
        answer: _answer,
        points: isCorrect ? maxPoints : 0,
      })) {
        return;
      }

      setSubmitted(true);
      if (isCorrect == false && timeout && trials + 1 < maxTrials) {
        startTimer();
      }
    },
    [submitDisabled, answer, checker, scorer, type, maxPoints, trials,
     maxTrials, answerQuestion, timeout, startTimer]
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
        if (timeoutRunning) {
          msg += ` ${t("quiz.delay")} ${timeLeft} ${t("quiz.seconds")}.`;
        } else if (trials < maxTrials && maxTrials > 1) {
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
  }, [t, submissionErrored, isCorrect, timeoutRunning,
      trials, maxTrials, points, timeLeft]);

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
    : timeoutRunning ? <RiTimerLine />
    : isCorrect === false ? <RiCloseCircleLine />
    : null,
  [submissionErrored, isCorrect, submitted, timeoutRunning, type]);

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

  const normalizedAnswer = React.useMemo(() => getNormalizedAnswer(answer), [answer]);

  return (
    <div className={`quiz ${correctnessClass}`}>
      {
        <div
          className="quiz-countdown"
          style={{
            transform: `scaleX(${
              timeoutRunning ? (timeLeft || 0) / timeout : 0
            })`,
          }}
        ></div>
      }

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
                  className={
                    normalizedAnswer === option.toLowerCase() ||
                    (type === "multichoice" &&
                      normalizedAnswer?.includes(option.toLowerCase()))
                      ? "selected "
                      : ""
                  }
                  onClick={(e) => onSubmit(e, option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {message && <p className="quiz-message">{message}</p>}
        {submissionErrored &&
          <div
            className="bg-red-100 order-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
            role="alert"
          >
            <p>{t("quiz.submission-error")}</p>
          </div>
        }
        {formatError && <p className="error">{formatError}</p>}
        {childrenWithProps}
      </form>
    </div>
  );
}

const answerFromOption = (
  option: string,
  currentAnswer: string | string[],
  type: QuestionTypes,
) =>
  type !== "multichoice" ? option
  : !Array.isArray(currentAnswer) ? [option]
  : currentAnswer.includes(option) ? currentAnswer.filter((v) => v !== option)
  : [...currentAnswer, option];

export const getNormalizedAnswer = (answer: string | string[] | null) =>
  typeof answer === "string" ? answer.trim().toLowerCase()
  : answer?.map((x) => x.trim().toLowerCase());

