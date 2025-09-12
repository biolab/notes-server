export const determineQuestionType = (
  {options, longtext}
    : {options?: string[] | null, longtext?: boolean | null
  }
) =>
  options?.length ? "singlechoice"
  : longtext ? "long-text"
  : "text";

export const corrSym = (isCorrect: boolean | undefined) =>
  isCorrect === undefined ? "⨀"
                          : isCorrect ? "✓"
                                      : "✕";

export const corrColor = (isCorrect: boolean | undefined) =>
  isCorrect === undefined ? "white"
                          : isCorrect ? "lawngreen"
                                      : "pink";
