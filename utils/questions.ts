export const determineQuestionType = (
  {options, multichoice, longtext}
    : {
    options?: string[] | null,
    multichoice?: boolean | null, longtext?: boolean | null
  }
) =>
  options?.length
  ? (multichoice ? "multichoice" : "singlechoice")
  : (longtext ? "long-text" : "text");