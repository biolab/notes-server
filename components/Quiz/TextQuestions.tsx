import React from "react";
import { useIntl } from "@/i18n";

const TextSubmitButton = ({onSubmit, disabled}: {
  onSubmit: (e: React.MouseEvent) => void;
  disabled: boolean}
) => {
  const { t } = useIntl();
  return <button disabled={disabled} onClick={onSubmit}>
    {t("quiz.submit-button")}
  </button>
}

type TextualSubmitProps = {
  submitDisabled: boolean;
  answer: string | null;
  checker: ((option: string) => string | null) | undefined;
  onSubmit: (answer: string, normalizedAnswer?: string | null) => void;
  setFormatError: (err: string | null) => void;
}

type TextualQuestionProps = TextualSubmitProps &  {
  onChange: (e: {target: {value: string}}) => void;
}

const useOnSubmitText = ({submitDisabled, answer, checker, onSubmit, setFormatError}: TextualSubmitProps) =>
  React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (submitDisabled || !answer) {
      return;
    }
    const normalizedAnswer = answer.trim().toLowerCase();
    const errored = checker ? checker(normalizedAnswer) : null;
    setFormatError(errored);
    if (errored) {
      return;
    }
    onSubmit(answer, normalizedAnswer);
  }, [onSubmit, answer, checker, submitDisabled, setFormatError]);

export const LongTextQuestion = ({answer, onChange, ...submitProps}: TextualQuestionProps) =>
  <>
    <textarea value={answer || ""} onChange={onChange} />
    <TextSubmitButton
      onSubmit={useOnSubmitText({answer, ...submitProps})}
      disabled={!answer}
    />
  </>

export const TextQuestion = ({answer, onChange, ...submitProps}: TextualQuestionProps) =>
  <>
    <input type="text" value={answer || ""} onChange={onChange} />
    <TextSubmitButton
      onSubmit={useOnSubmitText({answer, ...submitProps})}
      disabled={!answer}
    />
  </>
