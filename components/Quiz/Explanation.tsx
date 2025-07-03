import React, { JSX } from "react";
import { useIntl } from "../../i18n";

export interface IExplanation {
  after?: "attempt" | "correct" | "correctOrMaxTrials" | null;
  ntrials?: number;
  maxTrialsUsed?: boolean;
  correct?: boolean;
  gptExplanation?: string;
  children?: JSX.Element | JSX.Element[];
}

export function Explanation({
  after,
  ntrials,
  maxTrialsUsed,
  correct,
  gptExplanation,
  children,
}: IExplanation) {
  /* Whether the explanation is offered depends upon `after`, which can be:
     - 'correct': show only after the correct answer,
     - 'attempt': show only after at least one attempt,
     - null: show always.
     */
  const [shown, setShown] = React.useState(false);
  const { t } = useIntl();

  React.useEffect(() => {
    if (
      after &&
      !["attempt", "correct", "correctOrMaxTrials"].includes(after)
    ) {
      throw new Error(
        "invalid value for prop `after`; allowed values are null, 'attempt', 'correct' and 'correctOrMaxTrials'"
      );
    }
  }, [after]);

  const button = React.useMemo(() => {
    if (correct) {
      /* If the answer is correct, we offer an "explanation"; the user already knows the answer. */
      return t(shown ? "chapter.hideexplanation" : "chapter.showexplanation");
    }

    if (maxTrialsUsed && after === "correctOrMaxTrials") {
      return t(shown ? "chapter.hideexplanation" : "chapter.showexplanation");
    }

    if (!after || (after == "attempt" && ntrials)) {
      /* Otherwise, we offer an "answer" and not an "explanation", lest the user could believe
         that (s)he'll be given an explanation of the question or the path to the solution,
         rather than the spoiler, which is the actual case. */
      return t(shown ? "chapter.hideanswer" : "chapter.showanswer");
    }

    return null;
  }, [after, correct, ntrials, shown, t, maxTrialsUsed]);

  const renderExplanationContent = React.useMemo(() => {
    if (gptExplanation && !correct && !maxTrialsUsed) {
      return (
        <>
          <p>{gptExplanation}</p>
          <p style={{ fontSize: "0.8em", opacity: 0.7 }}>
            This answer was graded by ChatGPT
          </p>
        </>
      );
    }
    return children;
  }, [children, gptExplanation, correct, maxTrialsUsed]);

  if (!button) {
    return null;
  }

  return (
    <div className="quiz-explanation">
      <div className="quiz-explanation-button-div">
        <button type="button" onClick={() => setShown(!shown)}>
          {button}
        </button>
      </div>
      {shown && renderExplanationContent}
    </div>
  );
}
