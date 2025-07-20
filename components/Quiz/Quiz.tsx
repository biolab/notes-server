"use client";

import React, { JSXElementConstructor } from "react";
import { useTimer } from "use-timer";
import {
  RiCloseCircleLine,
  RiCheckboxCircleFill,
  RiTimerLine,
  RiOpenaiFill,
  RiErrorWarningLine,
} from "react-icons/ri";
import { useMountEffect } from "../../hooks/useMountEffect";
import { useIntl } from "../../i18n";
import { useCallback } from "react";
import { IAnswerValue, QuizContext } from "@/context/QuizContextProvider";
import { postAnswer as postAnswerApi } from "@/api/QuizService";
import { UserContext } from "@/context/UserContextProvider";
import { QuestionDef } from "@/utils/updatePaths";
import { toast } from "react-toastify";

export enum EventTypes {
  ANSWER_QUIZ = "ANSWER_QUIZ",
}

export interface IQuiz {
  id?: string;
  type: "multi" | "text" | "long-text";
  question: string;
  dbQuestions: QuestionDef[];
  multiSelect?: boolean;
  gpt?: boolean;
  options?: string[];
  neutralOptions?: string[];
  checker?: (option: string) => string | null;
  scorer?: (option: string) => boolean;
  gptExplanation?: string;
  answer?: string;
  points: number;
  optional?: boolean;
  trials?: number;
  timeout?: number;
  showQuiz?: boolean;
  children?: Element;
  bookId: number;
}

export default function Quiz({
  id = "",
  type,
  question,
  multiSelect = false, // Only works with type="multi", optional
  gpt = false,
  options = [],
  neutralOptions = [],
  checker,
  scorer: scorerFromMdx,
  answer: answerFromMdx,
  showQuiz,
  optional = false,
  points = 0,
  trials: max_trials = 1,
  timeout = 0,
  children,
  dbQuestions,
  bookId,
}: IQuiz) {
  const [answer, setAnswer] = React.useState<null | string | string[]>(null);
  const [normalizedAnswer, setNormalizedAnswer] = React.useState<
    null | string | string[]
  >(null);
  const { quizReducer, quizState } = React.useContext(QuizContext);
  const [error, setError] = React.useState<null | string>(null);
  const [correct, setCorrect] = React.useState<null | boolean>(null);
  const [isNeutral, setIsNeutral] = React.useState(false);
  const [trial, setTrial] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);
  const [gptExplanation] = React.useState<null | string>(null);
  const [isLoading] = React.useState(false);
  const { t } = useIntl();
  const { user } = React.useContext(UserContext);

  const dbQuestion = React.useMemo(() => {
    return dbQuestions.find((q) => q.question === question)!;
  }, [dbQuestions, question]);

  // TODO - Replace with actual LLM call
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // const answerFromLLM = () => ({
  //   data: { grade: "yes", explanation: "Mocked explanation" },
  // });

  // const processResponse = useCallback(
  //   async (question: any, userAnswer: any, answer: any) => {
  //     setIsLoading(true);
  //     try {
  //       const data = await answerFromLLM({ question, userAnswer, answer });
  //       if (data && data.data.grade) {
  //         if (data.data.grade === "no") {
  //           setGptExplanation(data.data.explanation);
  //         }
  //         return data.data.grade === "yes";
  //       }
  //       return true;
  //     } catch (_error) {
  //       return false;
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   },
  //   []
  // );

  const scorer = React.useMemo(() => {
    if (gpt) {
      return () => true;
      // return async (userAnswer) =>
      //   await processResponse(question, userAnswer, answerFromMdx);
    }
    if (answerFromMdx && !scorerFromMdx) {
      return (x: string) => x === answerFromMdx.trim().toLowerCase();
    }
    return scorerFromMdx;
  }, [answerFromMdx, scorerFromMdx, gpt]);

  const questionId = React.useMemo(() => id || question, [id, question]);

  const {
    time: timeLeft,
    start: startTimer,
    status: timerStatus,
  } = useTimer({
    initialTime: timeout,
    endTime: 0,
    timerType: "DECREMENTAL",
  });

  const postAnswer = useCallback(
    ({ value }: { value: IAnswerValue }) => {
      postAnswerApi({
        id: dbQuestion.id!,
        bookId: bookId,
        user,
        value,
      }).catch((error) => {
        toast.error(
          `Something went wrong. Answers are not saved.${
            error.message ? ` Error: ${error.message}` : ""
          }`
        );
      });
    },
    [bookId, dbQuestion.id, user]
  );

  useMountEffect(() => {
    if (multiSelect && (type !== "multi" || !optional || scorer || checker)) {
      throw new Error(
        "Multi select works only with type='multi', optional and no scorer and checker"
      );
    }

    if (type === "multi" && answerFromMdx && !options.includes(answerFromMdx)) {
      throw new Error(
        `The answer "${answerFromMdx}" is not offered in options`
      );
    }

    const valueInState = quizState?.questions.find(
      (q) => q.questionId === questionId
    );

    if (!valueInState) {
      return;
    }

    if (!valueInState.answers?.length) {
      return;
    }

    setTrial(valueInState.answers.length);
    const { answer, isCorrect, isNeutral } =
      valueInState.answers[valueInState.answers.length - 1];

    if (type === "long-text" && !gpt) {
      setSubmitted(true);
    }

    setAnswer(answer);
    setNormalizedAnswer(getNormalizedAnswer(answer));
    setIsNeutral(isNeutral);

    setCorrect(isCorrect);
  });

  const timeoutRunning = React.useMemo(
    () => timeout && timerStatus === "RUNNING" && timeLeft,
    [timerStatus, timeLeft, timeout]
  );

  const message = React.useMemo(() => {
    if (type === "long-text" && !gpt) {
      return null;
    }
    if (gpt && error) {
      return null;
    }
    if (isNeutral || !trial) {
      const remaining = max_trials - trial;
      return max_trials && max_trials > 1
        ? `You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"}.`
        : "";
    }
    if (correct && points) {
      return `Correct! You scored ${points} point${points === 1 ? "" : "s"}.`;
    }
    if (timeoutRunning) {
      return `Your answer is not correct. You may answer again in ${timeLeft} seconds.`;
    }
    if (correct === false && trial < max_trials) {
      if (trial < max_trials) {
        const remaining = max_trials - trial;
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
    isNeutral,
    correct,
    timeoutRunning,
    trial,
    max_trials,
    points,
    timeLeft,
    gpt,
    error,
  ]);

  const disabled = React.useMemo(() => {
    if (quizState!.isQuizComplete || correct || timeoutRunning || isLoading) {
      return true;
    }
    if (!max_trials) {
      return false;
    }
    return trial >= max_trials;
  }, [quizState, correct, timeoutRunning, isLoading, max_trials, trial]);

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
        multiSelect,
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

      let isCorrect: null | boolean = null;

      if (scorer && !optional) {
        // For gpt-text, use the async scorer function
        if (gpt) {
          isCorrect = await scorer(_answer as string);
        } else {
          isCorrect = scorer(_normalizedAnswer as string) as boolean;
        }
      }

      const _isNeutral =
        neutralOptions.includes(option) ||
        (type === "long-text" && !gpt) ||
        !scorer;
      setCorrect(isCorrect);
      setIsNeutral(_isNeutral);

      if (!_isNeutral) {
        setTrial((v) => v + 1);
      }

      const event: { type: EventTypes; value: IAnswerValue } = {
        type: EventTypes.ANSWER_QUIZ,
        value: {
          questionId,
          isCorrect,
          isNeutral: _isNeutral,
          answer: _answer,
          points: isCorrect ? points : 0,
          trial,
        },
      };

      postAnswer(event);
      quizReducer(event);
      setSubmitted(true);

      if (!_isNeutral && !isCorrect && timeout && trial + 1 < max_trials) {
        startTimer();
      }
    },
    [
      disabled,
      answer,
      multiSelect,
      checker,
      scorer,
      optional,
      neutralOptions,
      type,
      gpt,
      questionId,
      points,
      trial,
      max_trials,
      postAnswer,
      quizReducer,
      timeout,
      startTimer,
    ]
  );

  const className = React.useMemo(() => {
    if (isNeutral) {
      return "neutral";
    }

    return correct ? "correct" : correct === false ? "incorrect" : "";
  }, [isNeutral, correct]);

  const icon = React.useMemo(() => {
    if (type === "long-text" && !gpt && submitted) {
      return <RiCheckboxCircleFill />;
    }
    if (gpt && isLoading) {
      return <RiOpenaiFill />;
    }
    if (gpt && error) {
      return <RiErrorWarningLine />;
    }
    if (isNeutral) {
      return null;
    }
    if (correct) {
      return <RiCheckboxCircleFill />;
    }
    if (correct === false) {
      return timeoutRunning ? <RiTimerLine /> : <RiCloseCircleLine />;
    }

    return null;
  }, [
    correct,
    isNeutral,
    submitted,
    timeoutRunning,
    isLoading,
    error,
    type,
    gpt,
  ]);

  if (!showQuiz) {
    return null;
  }

  const childrenWithProps: any = React.Children.map(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as JSXElementConstructor<any>).name === "Explanation"
    ) {
      return React.cloneElement(child as React.ReactElement<any>, {
        ntrials: trial,
        maxTrialsUsed: !!(max_trials && max_trials === trial),
        correct: correct,
        gptExplanation: gptExplanation,
      });
    }
    return child;
  });

  return (
    <div className={`quiz ${className}`}>
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
          {question} {!!points && <span>({points}pt.)</span>}
        </h3>

        {icon}
      </div>

      <form>
        <fieldset disabled={disabled}>
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
                    (multiSelect &&
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

          {!!neutralOptions?.length && (
            <>
              <hr />
              <div className="buttons-wrapper">
                {neutralOptions.map((option) => (
                  <React.Fragment key={option}>
                    <button
                      className={
                        normalizedAnswer === option.toLowerCase()
                          ? "selected"
                          : ""
                      }
                      onClick={(e) => onSubmit(e, option, true)}
                      key={option}
                    >
                      {option}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
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
  multiSelect: boolean,
  isNeutralOption?: boolean
) {
  const _answer = option || "";

  if (!multiSelect || isNeutralOption) {
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

function getNormalizedAnswer(answer: string | string[]) {
  if (typeof answer === "string") {
    return answer.trim().toLowerCase();
  }

  if (Array.isArray(answer)) {
    return answer.map((a) => a.trim().toLowerCase());
  }

  // This should probably not happen
  return answer;
}
