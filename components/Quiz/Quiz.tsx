import React, { JSXElementConstructor } from "react";
import { useTimer } from "use-timer";
import { RiCloseCircleLine, RiCheckboxCircleFill, RiTimerLine} from "react-icons/ri";
import { useIntl } from "../../i18n";
import { QuizContext, useLastAnswer } from "@/context/QuizContextProvider";
import { QuestionTypes } from "@/types/types";

export interface QuizPropsBase {
  question: string;
  id?: string;
  options?: string[];
  checker?: (option: string) => string | null;
  timeout?: number;
  children?: Element;
}

export interface IQuestion extends QuizPropsBase {
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
  const { answerQuestion, quizState, getAnswers } = React.useContext(QuizContext);
  // const { isCorrect: correct, trials } = useLastAnswer(id || question);
  const [answer, setAnswer] =
    React.useState<null | string | string[]>(null);
  const [normalizedAnswer, setNormalizedAnswer] = 
    React.useState<null | string | string[]>(null);
  const answers = React.useMemo(
    () => getAnswers(id || question),
    [getAnswers, id, question]);
  const correct = React.useMemo(
    () => answers.length === 0 ? null : answers[answers.length - 1].isCorrect,
    [answers]);
  const trial = React.useMemo(
    () => answers.filter((a) => !a.isCorrect === undefined).length,
    [answers]);
  const [error, setError] = React.useState<null | string>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [isLoading] = React.useState(false);
  const { t } = useIntl();

  const {
    time: timeLeft,
    start: startTimer,
    status: timerStatus,
  } = useTimer({
    initialTime: timeout,
    endTime: 0,
    timerType: "DECREMENTAL",
  });

  React.useEffect(() => {
    if (answers.length === 0) {
      return;
    }
    const { answer } = answers[answers.length - 1];
    if (type === "long-text") {
      setSubmitted(true);
    }
    setAnswer(answer);
    setNormalizedAnswer(getNormalizedAnswer(answer));
  },
  [answers, type]);

  const timeoutRunning = React.useMemo(
    () => timeout && timerStatus === "RUNNING" && timeLeft,
    [timerStatus, timeLeft, timeout]
  );

  const message = React.useMemo(() => {
    if (type === "long-text") {
      return null;
    }
    if (correct === undefined || !trial) {
      const remaining = maxTrials - trial;
      return maxTrials && maxTrials > 1
        ? `You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"}.`
        : "";
    }
    if (correct && maxPoints) {
      return `Correct! You scored ${maxPoints} point${maxPoints === 1 ? "" : "s"}.`;
    }
    if (timeoutRunning) {
      return `Your answer is not correct. You may answer again in ${timeLeft} seconds.`;
    }
    if (correct === false && trial < maxTrials) {
      if (trial < maxTrials) {
        const remaining = maxTrials - trial;
        return `Your answer is not correct. You have ${remaining} ${
          remaining === 1 ? "attempt" : "attempts"
        } left.`;
      } else {
        return "Your answers were not correct.";
      }
    }
    return "";
  }, [
    type,
    correct,
    timeoutRunning,
    trial,
    maxTrials,
    maxPoints,
    timeLeft,
  ]);

  const disabled = React.useMemo(() =>
    quizState!.isQuizComplete
    || correct
    || timeoutRunning
    || isLoading
    || maxTrials && trial >= maxTrials,
  [quizState, correct, timeoutRunning, isLoading, maxTrials, trial]);

  const onSubmit = React.useCallback(
    async (
      e: React.MouseEvent,
      option: string,
      isNeutralOption: boolean = false
    ) => {
      e.preventDefault();

      if (disabled || !option) {
        return;
      }

      const _answer = getAnswer(
        option,
        answer as string | string[],
        type,
        isNeutralOption
      );
      const _normalizedAnswer = getNormalizedAnswer(_answer);

      setAnswer(_answer);
      setNormalizedAnswer(_normalizedAnswer);
      setError(null);

      if (checker) {
        const _checker = checker(_normalizedAnswer as string);

        if (_checker) {
          setError(_checker);
          return;
        }
      }

      const isCorrect = scorer(_normalizedAnswer as string);
      await answerQuestion({
        questionId: id || question,
        isCorrect,
        answer: _answer,
        points: isCorrect ? maxPoints : 0,
      });

      setSubmitted(true);

      if ((isCorrect === null || isCorrect == false) && !isCorrect && timeout && trial + 1 < maxTrials) {
        startTimer();
      }
    },
    [
      disabled,
      answer,
      checker,
      scorer,
      type,
      id,
      question,
      maxPoints,
      trial,
      maxTrials,
      answerQuestion,
      timeout,
      startTimer,
    ]
  );

  const correctnessClass = React.useMemo(() =>
    correct === undefined ? "neutral"
    : correct === true ? "correct"
    : correct === false ? "incorrect"
    : "",
   [correct]);

  const icon = React.useMemo(() => {
    if (type === "long-text" && submitted) {
      return <RiCheckboxCircleFill />;
    }
    if (correct === true) {
      return <RiCheckboxCircleFill />;
    }
    if (correct === false) {
      return timeoutRunning ? <RiTimerLine /> : <RiCloseCircleLine />;
    }

    return null;
  }, [
    correct,
    submitted,
    timeoutRunning,
    type,
  ]);

  const childrenWithProps: any = React.Children.map(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as JSXElementConstructor<any>).name === "Explanation"
    ) {
      return React.cloneElement(child as React.ReactElement<any>, {
        ntrials: trial,
        maxTrialsUsed: !!(maxTrials && maxTrials === trial),
        correct,
      });
    }
    return child;
  });

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
        <fieldset disabled={!!disabled}>
          {type.includes("text") && (
            <>
              {type === "long-text" ? (
                <textarea
                  value={answer || ""}
                  onChange={(e) => {
                    setSubmitted(false);
                    setAnswer(e.target.value);
                    setError(null);
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={answer || ""}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setError(null);
                  }}
                />
              )}

              {!correct && (
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
        {error && <p className="error">{error}</p>}
        {childrenWithProps}
      </form>
    </div>
  );
}

function getAnswer(
  option: string,
  currentAnswer: string | string[],
  type: QuestionTypes,
  isNeutralOption?: boolean
) {
  const _answer = option || "";

  if (type !== "multichoice" || isNeutralOption) {
    return _answer;
  }

  if (!Array.isArray(currentAnswer)) {
    return [_answer];
  }

  if (currentAnswer.includes(_answer)) {
    return (currentAnswer as string[]).filter((v) => v !== _answer);
  }

  return [...new Set([...currentAnswer, _answer])];
}

const getNormalizedAnswer = (answer: string | string[]) =>
  Array.isArray(answer)
  ? answer.map((a) => a.trim().toLowerCase())
  : answer.trim().toLowerCase();
