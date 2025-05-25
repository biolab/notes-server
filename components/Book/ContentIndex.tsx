import React from "react";
import { ImShrink2, ImEnlarge2 } from "react-icons/im";
import {
  RiCheckboxBlankCircleLine,
  RiCheckboxCircleFill,
  RiRecordCircleLine,
} from "react-icons/ri";
import Link from "next/link";
import slugify from "slugify";
import { useIntl } from "../../i18n";

/* import { QuizContext } from "../../contexts/QuizContext";

const QuizState = ({ chapterIndex }: { chapterIndex: number }) => {
  const { quizState, allCompletedChapters, chaptersWithMandatoryQuestions } =
    React.useContext(QuizContext);

  if (!chaptersWithMandatoryQuestions.includes(chapterIndex)) {
    return null;
  }

  if (allCompletedChapters.includes(chapterIndex)) {
    return <RiCheckboxCircleFill className="active" />;
  }
  if (quizState.activeChapters.includes(chapterIndex)) {
    return <RiRecordCircleLine className="active" />;
  }
  if (quizState.chaptersWithQuiz.includes(chapterIndex)) {
    return <RiCheckboxBlankCircleLine className="inactive" />;
  }

  return null;
};

const QuizProgress = () => {
  const { availablePoints, achievedPoints, quizState } =
    React.useContext(QuizContext);

  const { width, color } = React.useMemo(() => {
    return {
      width: (achievedPoints / availablePoints) * 100,
      color:
        achievedPoints / availablePoints >= quizState.quizThreshold
          ? "green"
          : "red",
    };
  }, [achievedPoints, availablePoints, quizState.quizThreshold]);

  return (
    <>
      <div className="quiz-progress-indicator-wrapper">
        <div
          className="quiz-progress-indicator-bar"
          style={{ width: `${width}%`, backgroundColor: color }}
        >
          <div
            className="quiz-progress-indicator-bar-threshold-line"
            style={{ left: `${quizState.quizThreshold * 100}%` }}
          />
        </div>
      </div>
      <div
        className="quiz-progress-indicator-threshold"
        style={{ left: `${quizState.quizThreshold * 100}%` }}
      >
        {quizState.quizThreshold * 100}%
      </div>
    </>
  );
};
*/
interface ContentIndexProps {
  contentTitle?: string;
  chapters: any[];
  isChapterIndexVisible: Record<number, boolean>;
  showQuizProgress?: boolean;
  className?: string;
}

export const ContentIndex = (
  { chapters, isChapterIndexVisible, showQuizProgress, className, contentTitle }: ContentIndexProps) =>
{
  const highestVisibleIndex = React.useMemo(() => {
    let highestIndex = 0;

    Object.keys(isChapterIndexVisible).forEach((c) => {
      const chapterIndex = parseInt(c);
      if (isChapterIndexVisible[chapterIndex] && chapterIndex > highestIndex) {
        highestIndex = chapterIndex;
      }
    });

    return highestIndex;
  }, [isChapterIndexVisible]);

  return (<>
      <div className={`content ${className || ""}`}>
        { contentTitle && <h2>{contentTitle}</h2> }

        <ul>
          {chapters.map(({frontmatter}, index) => (
            <li className="content-index-chapter" key={index}>
              <Link legacyBehavior href={"#" + slugify(frontmatter.title)}>
                <a className={highestVisibleIndex === index ? "active" : ""}>
                  {frontmatter.title}
                </a>
              </Link>

              {/*showQuizProgress && <QuizState chapterIndex={index}/> */}
            </li>
          ))}
        </ul>
      </div>

      {/*showQuizProgress && <QuizProgress/>*/}
    </>
  );
}

export const ContentIndexControl = ({ chapters, isChapterIndexVisible, showQuizProgress, startSmall }) => {
  const [small, setSmall] = React.useState(startSmall);
  const { t } = useIntl();

  return (
    <div className={small ? "small content-index" : "content-index"}>
      <div className="toolbar">
        <button className="icon-button" onClick={() => setSmall(!small)}>
          {small ? <ImEnlarge2 /> : <ImShrink2 />}
        </button>
      </div>
      <ContentIndex
        contentTitle={t("book.chapters")}
        chapters={chapters}
        showQuizProgress={showQuizProgress}
        isChapterIndexVisible={isChapterIndexVisible}/>
    </div>
  );
};
