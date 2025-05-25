import React from "react";
import { useOnScreen } from "../../hooks/useOnScreen";
import { useIntl } from "../../i18n";
import slugify from "slugify";
import { MdxContent } from "./MdxContent";
/* import { QuizContext } from "../../contexts/QuizContext"; */

export const Chapter = ({
  frontmatter,
  content,
  index,
  setIsChapterIndexVisible,
  hideQuestions,
  chapterNumber,
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(ref);
/*  const { quizState } = React.useContext(QuizContext); */
  const { t } = useIntl();

  React.useEffect(() => {
    setIsChapterIndexVisible((val) => ({ ...val, ...{ [index]: isVisible } }));
  }, [isVisible, setIsChapterIndexVisible, index]);

  const mdxContent = React.useMemo(() => {
    return (
      <MdxContent
        chapterIndex={index}
        content={content}
        hideQuestions={false /* hideQuestions */}
        showQuiz={false /* quizState.activeChapters.includes(index)} */}
        chapterTitle={frontmatter.title}
      />
    );
  }, [content, frontmatter.title, hideQuestions, index, /* quizState.activeChapters */]);

  return (
    <div ref={ref} className="flex-container">
      <div className="right-column">
        <div className="prose mx-auto mt-8 chapter">
          <h2 className="chapter-title" id={slugify(frontmatter.title)}>
            {chapterNumber && `${t("book.chapter")} ${chapterNumber}: `}
            {frontmatter.title}
          </h2>

          {mdxContent}
        </div>
      </div>
    </div>
  );
};
