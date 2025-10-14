import React from "react";
import { useIntl } from "@/i18n";

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

  const onSubmitText = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!onSubmit || !answer) {
      return;
    }
    const errored = checker ? checker(answer.trim().toLowerCase()) : null;
    setFormatError(errored);
    if (!errored) {
      onSubmit(answer);
    }
  }, [onSubmit, answer, checker, setFormatError]);

  const onChange = React.useCallback((e: {target: {value: string}}) => {
    setSubmitted(false);
    setAnswer(e.target.value);
    setFormatError(null);
  }, [setSubmitted, setAnswer, setFormatError]);

  return <>
    {long ? <textarea value={answer || ""} onChange={onChange}/>
          : <input type="text" value={answer || ""} onChange={onChange}/>}
    { long && formatError && <p className="checker-message">{formatError}</p> }
    <button disabled={!onSubmit} onClick={onSubmitText}>
      {t("quiz.submit-button")}
    </button>
    { !long && formatError && <p className="checker-message">{formatError}</p> }
  </>
}

export const TextQuestion = (props: TextQuestionProps) =>
  <BaseTextQuestion {...props}/>

export const LongTextQuestion = (props: TextQuestionProps) =>
  <BaseTextQuestion long {...props}/>
