import React, { JSX } from "react";
import { useIntl } from "@/i18n";


export interface IExplanation {
  after?: "attempt" | "correct" | "done" | null;
  nattempts?: number;
  attemptsExhausted?: boolean;
  isCorrect?: boolean;
  gptExplanation?: string;
  children?: JSX.Element | JSX.Element[];
}

export function Explanation({
  after,
  nattempts,
  attemptsExhausted,
  isCorrect,
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

  const button = React.useMemo(() => {
    if (isCorrect) {
      /* If the answer is correct, we offer an "explanation"; the user already knows the answer. */
      return t(shown ? "chapter.hideexplanation" : "chapter.showexplanation");
    }

    if (attemptsExhausted && after === "done") {
      return t(shown ? "chapter.hideexplanation" : "chapter.showexplanation");
    }

    if (!after || (after == "attempt" && nattempts)) {
      /* Otherwise, we offer an "answer" and not an "explanation", lest the user could believe
         that (s)he'll be given an explanation of the question or the path to the solution,
         rather than the spoiler, which is the actual case. */
      return t(shown ? "chapter.hideanswer" : "chapter.showanswer");
    }

    return null;
  }, [after, isCorrect, nattempts, shown, t, attemptsExhausted]);

  const renderExplanationContent = React.useMemo(() => {
    if (gptExplanation && !isCorrect && !attemptsExhausted) {
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
  }, [children, gptExplanation, isCorrect, attemptsExhausted]);

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
