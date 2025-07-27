export const determineQuestionType = (
  {options, neutralOptions, multichoice, longtext}
    : {
    options?: string[] | null, neutralOptions?: string[] | null,
    multichoice?: boolean | null, longtext?: boolean | null
  }
) =>
  options?.length || neutralOptions?.length
  ? (multichoice ? "multichoice" : "singlechoice")
  : (longtext ? "long-text" : "text");