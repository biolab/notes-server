import React, { JSXElementConstructor } from "react";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine, RiRecordCircleLine, RiFundsLine,
} from "react-icons/ri";

import { UserDesc } from "@/api/quiz";
import { QuestionTypes } from "@/types";
import { corrColor, corrSym } from "@/utils/questions";
import { useIntl } from "@/i18n";
import { QuizContext, useBatchSubmission, useFileAnswer, useLastAnswer } from "@/context/QuizContextProvider";
import { FileDropFunction, FileQuestion } from "./UploadQuestion";
import { FileDockQuestion } from "@/components/Quiz/FileDockQuestion";
import { LongTextQuestion, TextQuestion } from "./TextQuestions";
import { SingleChoiceQuestion } from "./SingleChoiceQuestion";


export interface QuizPropsBase {
  question: string;
  options?: string[];
  checker?: (option: string) => string | null;
  children?: React.ReactNode;
}

interface IQuestion extends QuizPropsBase {
  id: string;
  type: QuestionTypes;
  scorer: ((option: string) => (boolean | undefined)) | undefined
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

export default function Question(props: IQuestion) {
  const { maxAttempts, maxPoints } = React.useContext(QuizContext).getQuestionSettings(props.id)!;
  return props.type.startsWith("upload") ? UploadQuestion({...props, maxAttempts}) : ValueQuestion({...props, maxPoints, maxAttempts});
}

function ValueQuestion({type, id, question, options = [], checker, scorer,
                        maxPoints = 0, maxAttempts = 1, children, usersAnswers}: IQuestion & { maxPoints: number, maxAttempts: number }) {
  const { t } = useIntl();
  const [answer, setAnswer] = React.useState<null | string>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const { isCorrect, points, attempts, submissionErrored,
          answerQuestion, correctAnswer, answer: submittedAnswer } = useLastAnswer(id);
  const { displayedAnswer } = React.useContext(QuizContext);
  const batchSubmission = useBatchSubmission();
  React.useEffect(() => {
    const displayed = displayedAnswer(id);
    if (displayed) {
      setSubmitted(true);
      setAnswer(displayed);
    }
  }, [id, displayedAnswer])

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

  const pendingSubmission = React.useMemo(() =>
    batchSubmission && answer !== null && answer !== submittedAnswer,
    [batchSubmission, answer, submittedAnswer]
  );
  const correctnessClass = React.useMemo(() => {
    if (submissionErrored) {
      return "submission-errored";
    }
    if (pendingSubmission) {
      return "";
    }
    switch (isCorrect) {
      case undefined: return "neutral";
      case true: return "correct";
      case false: return "incorrect";
      default: return ""
    }
  }, [pendingSubmission, submissionErrored, isCorrect]);

  const icon = React.useMemo(() =>
    pendingSubmission ? <RiFundsLine />
    : submissionErrored ? <RiAlertLine />
    : type === "long-text" ? (submitted ? <RiRecordCircleLine /> : null)
    : isCorrect === true ? <RiCheckboxCircleFill />
    : isCorrect === false ? <RiCloseCircleLine />
    : null,
  [pendingSubmission, submissionErrored, isCorrect, submitted, type]);

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
        className={`quiz
                    ${batchSubmission ? "joint-submission" : ""}
                    ${pendingSubmission ? "pending-submission"
                      : (usersAnswers ? "" : correctnessClass)}`}
      >
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
                options={options} answer={answer} onSubmit={onSubmit} /> }
          </fieldset>

          { !usersAnswers &&
            <>
              { message &&
                <p className="quiz-message">{message}</p>
              }
              { submissionErrored &&
                <div
                  className="bg-red-100 border-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
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


function UploadQuestion({type, id, question, maxAttempts = 1}: IQuestion & { maxAttempts: number }) {
  const { t } = useIntl();
  const { files, submissionErrored } = useFileAnswer(id);

  const submitDisabled = React.useMemo(
    () => maxAttempts === 1 && files.length !== 0,
    [maxAttempts, files]);

  const icon = React.useMemo(() =>
      submissionErrored ? <RiAlertLine />
        : files.length ? <RiRecordCircleLine /> : null,
    [submissionErrored, files]);

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
    [setIsDragging])

  const accept = React.useContext(QuizContext).getCorrectAnswer(id);
  const acceptList = accept?.toLocaleLowerCase()
      ?.replaceAll("*", "")
      .replaceAll(";", " ")
      .replaceAll(",", " ")
      .split(/\s+/)
    || undefined;

  return <>
    <a id={`question-${id}`} />
    <div
      className="quiz"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {isDragging &&
        <div className="absolute inset-0 bg-blue-200/40 border-2 border-blue-400 rounded-md flex items-center justify-center pointer-events-none" />
      }
      <div className="quiz-question">
        <h3>
          {question}
        </h3>
        {icon}
      </div>

      <form>
        <fieldset disabled={submitDisabled}>
          { maxAttempts === 1
            ? <FileQuestion id={id} ref={onFileDropRef} accept={acceptList} multiple={type === "uploads"} />
            : <FileDockQuestion id={id} ref={onFileDropRef} accept={acceptList} multiple={type === "uploads"} />
          }
        </fieldset>
        { submissionErrored &&
          <div
            className="bg-red-100 border-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
            role="alert"
          >
            <p>
              { typeof submissionErrored === "string" ? submissionErrored : t("quiz.submission-error") }
            </p>
          </div>
        }
      </form>
    </div>
  </>;
}
