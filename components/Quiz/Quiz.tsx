import React, { JSXElementConstructor } from "react";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine, RiRecordCircleLine
} from "react-icons/ri";

import { UserDesc } from "@/api/quiz";
import { QuestionTypes } from "@/types";
import { corrColor, corrSym } from "@/utils/questions";
import { useIntl } from "@/i18n";
import { useLastAnswer } from "@/context/QuizContextProvider";
import { FileDropFunction, FileQuestion } from "./UploadQuestion";
import { LongTextQuestion, TextQuestion } from "./TextQuestions";
import { SingleChoiceQuestion } from "./SingleChoiceQuestion";


export interface QuizPropsBase {
  question: string;
  options?: string[];
  checker?: (option: string) => string | null;
  children?: Element;
}

interface IQuestion extends QuizPropsBase {
  id: string;
  type: QuestionTypes;
  scorer: ((option: string) => (boolean | undefined)) | undefined
  maxPoints: number;
  maxAttempts: number;
  accept?: string[];
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
  type, id, question, options = [], checker, scorer,
  maxPoints = 0, maxAttempts = 1, accept, children, usersAnswers }: IQuestion)
{
  const { t } = useIntl();
  const [answer, setAnswer] = React.useState<null | string>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const { isCorrect, points, attempts, answer: last, submissionErrored,
          answerQuestion, correctAnswer } = useLastAnswer(id);
  React.useEffect(() => {
    if (last) {
      setSubmitted(true);
      setAnswer(last);
    }
  }, [last])

  const submitDisabled = React.useMemo(() =>
    !!maxAttempts && attempts >= maxAttempts,
  [maxAttempts, attempts]);

  const onSubmit = React.useCallback(
    async (answer: string) => {
      const isCorrect = scorer && scorer(answer.trim().toLowerCase());
      if (await answerQuestion({
        answer,
        isCorrect,
        points: (scorer && isCorrect) ? maxPoints : 0})) {
        setSubmitted(true);
      }
    },
    [scorer, maxPoints, answerQuestion]
  );

  const message = React.useMemo(() => {
    if (submissionErrored) {
      return;
    }
    switch (isCorrect) {
      case null: {
        if (maxAttempts > 1) {
          return `${t("quiz.attempts")}: ${maxAttempts - attempts}`;
        }
        return;
      }
      case false: {
        let msg = t("quiz.incorrect");
        if (attempts < maxAttempts && maxAttempts > 1) {
          msg += ` ${t("quiz.remaining")}: ${maxAttempts - attempts}`
        }
        else {
          if (maxAttempts > 0 && correctAnswer) {
            msg += ` ${t("quiz.correct-answer")} "${correctAnswer}"`;
          }
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
  }, [t, submissionErrored, isCorrect, attempts, maxAttempts, points, correctAnswer]);

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
    : ["long-text", "upload", "uploads"].includes(type) ? (submitted ? <RiRecordCircleLine /> : null)
    : isCorrect === true ? <RiCheckboxCircleFill />
    : isCorrect === false ? <RiCloseCircleLine />
    : null,
  [submissionErrored, isCorrect, submitted, type]);

  const isUpload = React.useMemo(() => type === "upload" || type === "uploads", [type]);
  const [isDragging, setIsDragging] = React.useState(false);
  const onDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only deactivate when actually leaving the container, not child elements
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  }, []);

  const onFileDropRef = React.useRef<FileDropFunction | null>(null);
  const onDrop = React.useCallback((e:  React.DragEvent<HTMLElement>) => {
    setIsDragging(false);
    onFileDropRef.current?.(e);
  },
  [setIsDragging, onFileDropRef.current])

  const childrenWithProps: any = React.Children.map(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as JSXElementConstructor<any>).name === "Explanation"
    ) {
      return React.cloneElement(child as React.ReactElement<any>, {
        nattempts: attempts,
        attemptsExhausted: !!(maxAttempts && maxAttempts === attempts),
        isCorrect: !submissionErrored && isCorrect,
      });
    }
    return child;
  });

  const textProps  = React.useMemo(() => ({
    answer, setAnswer, checker, setSubmitted,
    onSubmit: !submitDisabled && onSubmit,
  }), [submitDisabled, checker, onSubmit, setSubmitted, answer, setAnswer]);

  return <>
    <a id={`question-${id}`} />
      <div
        className={`quiz ${usersAnswers ? "" : correctnessClass}`}
        onDrop={isUpload ? onDrop : undefined}
        onDragOver={isUpload ? onDragOver : undefined}
        onDragLeave={isUpload ? onDragLeave : undefined}
      >
        {isDragging &&
          <div className="absolute inset-0 bg-blue-200/40 border-2 border-blue-400 rounded-md flex items-center justify-center pointer-events-none" />
        }
        <div className="quiz-question">
          <h3>
            {question} {!!maxPoints && <span>({maxPoints}pt.)</span>}
          </h3>
          {icon}
        </div>

        <form>
          <fieldset disabled={submitDisabled}>
            { type === "text" && <TextQuestion {...textProps} /> }
            { type === "long-text" && <LongTextQuestion {...textProps} /> }
            { type === "singlechoice" && <SingleChoiceQuestion
                options={options} answer={usersAnswers ? "" : answer} onSubmit={onSubmit} /> }
            { isUpload && <FileQuestion
              id={id}
              submitDisabled={submitDisabled} /* TODO: is this needed? */
              setSubmitted={setSubmitted}
              ref={onFileDropRef}
              accept={accept}
              multiple={type === "uploads"}
            /> }
          </fieldset>

          { !usersAnswers &&
            <>
              { message &&
                <p className="quiz-message">{message}</p>
              }
              { submissionErrored &&
                <div
                  className="bg-red-100 order-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
                  role="alert"
                >
                  <p>
                    { typeof submissionErrored === "string"
                      ? submissionErrored
                      : t("quiz.submission-error")}
                  </p>
                </div>
              }
             { childrenWithProps}
            </>
          }
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
