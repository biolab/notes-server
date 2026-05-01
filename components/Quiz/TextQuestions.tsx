import React from "react";
import { useIntl } from "@/i18n";
import { useBatchSubmission } from "@/context/QuizContextProvider";

type TextQuestionProps = {
  answer: string | null;
  setAnswer: (answer: string) => void;
  checker: ((option: string) => string | null) | undefined;
  onSubmit: ((answer: string) => void) | false;
  setSubmitted: (submitted: boolean) => void;
}

export const BaseTextQuestion = (
  {onSubmit, long, setSubmitted, checker, answer, setAnswer}
    : TextQuestionProps & {long?: boolean}
) => {
  const { t } = useIntl();
  const [formatError, setFormatError] = React.useState<null | string>(null);
  const batchSubmission = useBatchSubmission();

  const doSubmit = React.useCallback((answer_: string) => {
    const errored = checker ? checker(answer_.trim().toLowerCase()) : null;
    setFormatError(errored);
    if (!errored && onSubmit) {
      onSubmit(answer_);
    }
  }, [checker, onSubmit, setFormatError]);

  const onSubmitText = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (answer) {
      doSubmit(answer);
    }
  }, [answer, doSubmit]);

  const onChange = React.useCallback((e: {target: {value: string}}) => {
    if (batchSubmission) {
      doSubmit(e.target.value);
    }
    else {
      setSubmitted(false);
      setFormatError(null);
    }
    setAnswer(e.target.value);
  }, [setSubmitted, setAnswer, setFormatError, doSubmit, batchSubmission]);

  return <>
    {long ? <textarea value={answer || ""} onChange={onChange}/>
          : <input type="text" value={answer || ""} onChange={onChange}/>}
    { long && formatError && <p className="checker-message">{formatError}</p> }
    { !batchSubmission &&
      <button disabled={!onSubmit} onClick={onSubmitText}>
        {t("quiz.submit-button")}
      </button>
    }
    { !long && formatError && <p className="checker-message">{formatError}</p> }
  </>
}

export const TextQuestion = (props: TextQuestionProps) =>
  <BaseTextQuestion {...props}/>

export const LongTextQuestion = (props: TextQuestionProps) =>
  <BaseTextQuestion long {...props}/>
