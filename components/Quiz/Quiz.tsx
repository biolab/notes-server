import React, { JSXElementConstructor } from "react";
import { RiAlertLine, RiCheckboxCircleFill, RiCloseCircleLine, RiDeleteBin2Line } from "react-icons/ri";

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
  type,
  id,
  question,
  options = [],
  checker,
  correctAnswer,
  scorer,
  maxPoints = 0,
  maxTrials = 1,
  accept,
  children,
  usersAnswers,
}: IQuestion) {
  const [answer, setAnswer] = React.useState<null | string>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitted, setSubmitted] = React.useState(false);
  const isUpload = React.useMemo(
    () => type.startsWith("upload") || undefined,
    [type]);
  const isMultiple = React.useMemo(
    () => type === "uploads" || undefined,
    [type]);

  const { isCorrect, points, trials, answer: last, submissionErrored,
          answerQuestion, uploadFiles } = useLastAnswer(id);
  React.useEffect(() => {
    if (last) {
      setSubmitted(true);
      setAnswer(last);
    }
  }, [last])
  const [formatError, setFormatError] = React.useState<null | string>(null);
  const { t } = useIntl();

  const submitDisabled = React.useMemo(
    () => maxTrials && trials >= maxTrials,
  [maxTrials, trials]);

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

  const onSubmitFiles = React.useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitDisabled || files.length === 0) {
      return;
    }
    if (await uploadFiles(files)) {
      setSubmitted(true);
      setFiles([]);
    }
  }, [files, uploadFiles, submitDisabled]);

  const onFilesAdd = React.useCallback(async (newFiles: File[]) => {
    const filtered = newFiles.filter(
      ({name}) => !accept?.length || accept.includes("." + (name.split('.').pop() || "")));
    if (!filtered.length) {
      return;
    }
    if (isMultiple) {
      const newFileNames = newFiles.map(({name}) => name);
      setFiles([
        ...files.filter(({name}) => !newFileNames.includes(name)),
        ...filtered]);
    }
    else {
      setFiles([filtered[0]]);
    }
  }, [files, isMultiple, accept]);

  const onRemoveFile = React.useCallback((name: string) => {
    setFiles(files.filter((f) => f.name !== name));
  }, [files]);

  const onFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await onFilesAdd([...event.target.files]);
    }
  }, [onFilesAdd]);

  const onFileDrop = React.useCallback(async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
      await onFilesAdd(
      [...event.dataTransfer.items]
        .map((item: DataTransferItem) => item.getAsFile())
        .filter((item) => item !== null));
  }, [onFilesAdd]);

  const onFileDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

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
    : (type === "long-text" || type.startsWith("upload")) && submitted ? <RiCheckboxCircleFill />
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
      <div
        className={`quiz ${usersAnswers ? "" : correctnessClass}`}
        onDrop={isUpload && onFileDrop}
        onDragOver={isUpload && onFileDragOver}
      >
        <div className="quiz-question">
          <h3>
            {question} {!!maxPoints && <span>({maxPoints}pt.)</span>}
          </h3>
          {icon}
        </div>

        <form>
          <fieldset disabled={!!submitDisabled}>
            { (type === "text" || type === "long-text") && <>
              { type === "long-text" ?
                <textarea
                  value={answer || ""}
                  onChange={(e) => {
                    setSubmitted(false);
                    setAnswer(e.target.value);
                    setFormatError(null);
                  }}
                />
                :
                <input
                  type="text"
                  value={answer || ""}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setFormatError(null);
                  }}
                />
              }
              <button
                disabled={!answer}
                onClick={(e) => onSubmit(e, answer as string)}
              >
                {t("quiz.submit-button")}
              </button>
            </>}

            {!!options?.length &&
              <div className="buttons-wrapper">
                {options.map((option) => (
                  <button
                    className={!usersAnswers && normalizedAnswer === option.toLowerCase() ? "selected " : ""}
                    onClick={(e) => onSubmit(e, option)}
                    key={option}
                  >
                    {option}
                  </button>
                ))}
             </div>
            }

            {isUpload && <>
              { answer &&
                <div className="mb-4">
                  { `${t("quiz.uploaded-file")} ${answer}.` }
                </div>
              }
              { !submitDisabled && <>
                { files.length > 0 &&
                  <div className="flex gap-4 my-4">
                    <div className="text-nowrap">
                      {t("quiz.upload-staged")}
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-4 mb-4">
                        {files.map((f =>
                            <div className="flex gap-1 border border-dashed rounded px-1 items-center" key={f.name}>
                              {f.name}
                              <RiDeleteBin2Line
                                onClick={() => onRemoveFile(f.name)}
                                style={{cursor: "pointer"}}
                              />
                            </div>
                        ))}
                      </div>
                      <button onClick={onSubmitFiles}>
                        {t(`quiz.upload${answer ? "-replace" : ""}-button`)}
                      </button>
                    </div>
                  </div>
                }
                <div className="flex items-center  justify-between">
                  <input id="file" type="file" multiple={type === "uploads"} onChange={onFileChange}
                           style={{display: 'none'}}/>
                  <label
                    htmlFor="file"
                    className={`px-10 py-2 mr-4 submit-quiz-popup-button border border-black rounded cursor-pointer transition inline-block`}
                  >
                    {t(isMultiple ? "quiz.select-files" : "quiz.select-file")}
                  </label>

                  <small className="form-text text-muted" style={{lineHeight: "1.4"}}>
                    {t(`quiz.upload-${isMultiple ? "multiple" : "single"}-desc`)}
                    { accept && <>
                      <br/>
                      {t("quiz.upload-allowed-extensions")}: {accept.join(", ")}
                    </> }
                  </small>
                </div>
                </>
              }
              </>
            }

            </fieldset>

            {!usersAnswers && message && <p className="quiz-message">{message}</p>
          }
          {submissionErrored &&
          <div
            className="bg-red-100 order-red-500 text-red-700 mt-2 p-1 pl-4 rounded"
              role="alert"
            >
              <p>{typeof submissionErrored === "string" ? submissionErrored : t("quiz.submission-error")}</p>
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
