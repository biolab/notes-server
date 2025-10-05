import React, { JSXElementConstructor } from "react";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine } from "react-icons/ri";

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
  scorer: (option: string) => (boolean | undefined)
  correctAnswer?: string;
  bookId: number;
  maxPoints: number;
  maxTrials: number;
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
  type, id, question, options = [], checker, correctAnswer, scorer,
  maxPoints = 0, maxTrials = 1, accept, children, usersAnswers }: IQuestion)
{
  const { t } = useIntl();
  const [answer, setAnswer] = React.useState<null | string>(null);
  const [formatError, setFormatError] = React.useState<null | string>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const { isCorrect, points, trials, answer: last, submissionErrored,
          answerQuestion } = useLastAnswer(id);
  const isUpload = React.useMemo(
    () => type === "upload" || type === "uploads",
    [type]);
  React.useEffect(() => {
    if (last) {
      setSubmitted(true);
      setAnswer(last);
    }
  }, [last])

  const submitDisabled = React.useMemo(() =>
    !!maxTrials && trials >= maxTrials,
  [maxTrials, trials]);

  const onSubmit = React.useCallback(
    async (answer: string, normalizedAnswer: string | null = null) => {
      const isCorrect = scorer(normalizedAnswer || answer);
      const points = isCorrect ? maxPoints : 0;
      if (await answerQuestion({answer, isCorrect, points})) {
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
        else {
          if (maxTrials > 0 && correctAnswer) {
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
  }, [t, submissionErrored, isCorrect, correctAnswer, trials, maxTrials, points]);

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
    : (type === "long-text" || isUpload) && submitted ? <RiCheckboxCircleFill />
    : isCorrect === true ? <RiCheckboxCircleFill />
    : isCorrect === false ? <RiCloseCircleLine />
    : null,
  [submissionErrored, isCorrect, submitted, type]);

  const onFileDropRef = React.useRef<FileDropFunction>(null);

  const onTextChange = React.useCallback((e: {target: {value: string}}) => {
    setSubmitted(false);
    setAnswer(e.target.value);
    setFormatError(null);
  }, [setSubmitted, setAnswer, setFormatError]);

  const textProps  = React.useMemo(() => ({
    submitDisabled,
    answer,
    checker,
    onSubmit,
    onChange: onTextChange,
    setFormatError
  }), [submitDisabled, answer, checker, onSubmit, onTextChange, setFormatError]);

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

  return <>
    <a id={`question-${id}`} />
      <div
        className={`quiz ${usersAnswers ? "" : correctnessClass}`}
        onDrop={onFileDropRef.current || undefined }
        onDragOver={isUpload ? (e) => e.preventDefault() : undefined}
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
                options={options} answer={usersAnswers ? "" : answer} onSubmit={onSubmit} /> }
            { (type === "upload" || type === "uploads") && <FileQuestion
              id={id}
              submitDisabled={submitDisabled}
              setSubmitted={setSubmitted}
              ref={onFileDropRef}
              accept={accept}
              multiple={type === "uploads"}/> }
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
             { formatError &&
               <p className="error">{formatError}</p>
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
