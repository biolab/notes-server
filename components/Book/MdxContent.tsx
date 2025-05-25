import React, { JSXElementConstructor } from "react";
import { MDXRemote } from "next-mdx-remote";
/*import Quiz, { IQuiz } from "../Quiz/Quiz";
import ActivateQuiz from "../Quiz/ActivateQuiz"; 
import { Explanation } from "../Quiz/Explanation";
*/
import { useIntl } from "../../i18n";
import Image from "../Image";
import CcByNcNd from "./CcByNcNd";

export const MdxContent = ({
  content,
  hideQuestions,
  chapterIndex,
  showQuiz,
  chapterTitle,
}: {
  content: any;
  hideQuestions?: boolean;
  chapterIndex?: number;
  showQuiz?: boolean;
  chapterTitle?: string;
}) => {
  const { t } = useIntl();

  return (
    <MDXRemote
      {...content}
      components={{
        Quiz: (props) => { return <div>Quiz</div>; /*
          if (chapterIndex === undefined) {
            throw new Error("Introduction cannot contain questions");
          }

          return hideQuestions ? null : (
            <Quiz chapterIndex={chapterIndex} showQuiz={true} {...props} />
          );*/
        },
        Explanation: (props) => <div>Explanation</div>, //<Explanation {...props} /> */, 
        Sidenote: ({children}) => <div className="float-aside">{children}</div>,
        ExpandingSideImg: ({src, alt, retina}) =>
          <Image
            src={src}
            layout="fill"
            objectFit="contain"
            alt={alt || "image"}
            className={"expanding-side-img" + (retina ? " retina" : "")}
          />,
        ReplayImg: ({ src, alt }) => {
          const [_src, setSrc] = React.useState(src ? src + "?" : null);

          const replay = React.useCallback(() => {
            setSrc((s: string) => `${s.split("?")[0]}?${Math.random()}`);
          }, []);

          if (!_src) {
            throw new Error("ReplayImg has missing src prop");
          }
          return (
            <>
              <Image className="replay-img" src={_src} alt={alt} />
              <a className="replay-img-button" onClick={replay}>
                {t("chapter.replay")}
              </a>
            </>
          );
        },
        YouTube: ({ embedId }) =>
          React.useMemo(
            () => (
              <div className="youtube-video">
                <iframe
                  width="853"
                  height="480"
                  src={`https://www.youtube.com/embed/${embedId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Embedded youtube"
                />
              </div>
            ),
            [embedId]
          ),
        CcByNcNd,
        QuizSection: ({ children }) =>  { return <div>Quiz Section</div>; /*
          const childrenWithProps = React.Children.map(children, (child) => {
            if (
              React.isValidElement(child) &&
              (child.type as JSXElementConstructor<any>).name === "Quiz"
            ) {
              return React.cloneElement(child as React.ReactElement<IQuiz>, {
                showQuiz: !!showQuiz,
                quizInsideQuizSection: true,
              });
            }
            return child;
          });

          if (hideQuestions) {
            return null;
          }
          return (
            <>
              <ActivateQuiz
                chapterIndex={chapterIndex!}
                chapterTitle={chapterTitle!}
              />
              <div className={showQuiz ? "" : "hidden-quiz-section"}>
                {childrenWithProps}
              </div>
            </>
          ); */
        },
      }}
    />
  );
};
