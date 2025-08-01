export const determineQuestionType = (
  {options, longtext}
    : {options?: string[] | null, longtext?: boolean | null
  }
) =>
  options?.length ? "singlechoice"
  : longtext ? "long-text"
  : "text";