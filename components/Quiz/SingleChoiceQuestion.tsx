import React from "react";

export const SingleChoiceQuestion = ({options = [], answer, setAnswer, onSubmit}: {
  options: string[];
  answer: string | null;
  setAnswer?: ((a: string) => void);
  onSubmit?: ((answer: string) => void);
}) => {
  const onSubmitOption = React.useCallback((e: React.MouseEvent, option: string) => {
    e.preventDefault();
    setAnswer?.(option);
    onSubmit?.(option);
  }, [setAnswer, onSubmit])
  return (
    <div className="buttons-wrapper">
      {options.map((option) => (
        <button
          className={answer?.trim().toLowerCase() === option.toLowerCase() ? "selected " : ""}
          onClick={(e) => onSubmitOption(e, option)}
          key={option}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
