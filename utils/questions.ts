export const determineQuestionType = ({options, longtext, upload, uploads}: {
  options?: string[] | null,
  longtext?: boolean | null,
  upload?: boolean | null,
  uploads?: boolean | null,
}) =>
  options?.length ? "singlechoice"
  : longtext ? "long-text"
  : upload ? "upload"
  : uploads ? "uploads"
  : "text";

export const corrSym = (isCorrect: boolean | undefined) =>
  isCorrect === undefined ? "⨀"
                          : isCorrect ? "✓"
                                      : "✕";

export const corrColor = (isCorrect: boolean | undefined) =>
  isCorrect === undefined ? "white"
                          : isCorrect ? "lawngreen"
                                      : "pink";
