import React, { useContext, useState } from "react";
import Image from "../Image";
/*
import { getBookId, QuizContextProvider } from "../../contexts/QuizContext";
import QuizProgress from "../Quiz/QuizProgress";
import { UserContext } from "../../contexts/UserContext";
import BookLogin from "../BookLogin/BookLogin";
import { SubmitQuiz } from "./SubmitQuiz";
import { useMutation } from "@tanstack/react-query";
*/
import { Chapter } from "./Chapter";
import { ContentIndexControl } from "./ContentIndex";
import { MdxContent } from "./MdxContent";
import { IntlContextProvider } from "../../i18n";
import Layout from "../layout";

const ignoreLogin = process && process.env.NEXT_PUBLIC_IGNORE_LOGIN === "true";

export const Book = ({ frontmatter, content, chapters, slug }) => {
  const [isChapterIndexVisible, setIsChapterIndexVisible] = useState({});
/*  const [quizState, setQuizState] = useState(null);
  const [quizStateFetched, setQuizStateFetched] = useState(false);

  const { user } = useContext(UserContext);
*/  const relativePath = React.useMemo(() => `/${slug}`, [slug]);
  const mdxContent = React.useMemo(
    /* hideQuestions is irrelevant because introduction can't contain them
       (and MdxContent throws an exceptions if it does) */
    () => <MdxContent content={content} />,
    [content]
  );
/*
  const { mutate: fetchBookState } = useMutation({
    mutationFn: () =>
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/state?book_id=${getBookId(
          frontmatter.title,
          slug
        )}`,
        {
          headers: {
            "access-token": user?.access_token,
          },
        }
      ).then((res) => res.json()),
    onError: () => {
      setQuizStateFetched(true);
    },
    onSuccess: (data) => {
      setQuizState(data);
      setQuizStateFetched(true);
    },
  });
*/
  const chapterNumbers = React.useMemo(() => {
    let counter = 1;
    let _chapterNumbers = {};

    chapters.forEach((c, index: number) => {
      if (c.frontmatter.omitAsChapter) {
        return;
      }

      _chapterNumbers[index] = counter;
      counter = counter + 1;
    });

    return _chapterNumbers;
  }, [chapters]);
/*
  React.useEffect(() => {
    if (!user?.access_token || !frontmatter.requireLogin || ignoreLogin) {
      return;
    }

    fetchBookState();
  }, [frontmatter.requireLogin, fetchBookState, user?.access_token]);

  React.useEffect(() => {
    if (frontmatter.hideQuestions && frontmatter.showQuizProgress) {
      throw new Error(
        "Incompatible options: hideQuestions: true and showQuizProgress: true"
      );
    }
  }, [frontmatter.hideQuestions, frontmatter.showQuizProgress]);

  if (frontmatter.requireLogin && !(user?.access_token || ignoreLogin)) {
    return (
      <BookLogin
        emailContent={frontmatter.email}
        title={frontmatter.title}
        loginSubtitle={frontmatter.loginSubtitle}
      />
    );
  }
  if (!ignoreLogin && frontmatter.requireLogin && frontmatter.logQuizzes && !quizStateFetched) {
    return null;
  }
*/
  return (
    <IntlContextProvider lang={frontmatter.language}>
  {/*    <QuizContextProvider
        title={frontmatter.title}
        quizState={quizState}
        slug={slug}
        submissionEmail={frontmatter.submissionEmail}
        quizThreshold={frontmatter.quizThreshold || 0.8}
        logQuizzes={frontmatter.logQuizzes}
      > */ }
        <Layout title={frontmatter.title}
                showHome={!frontmatter.tocInHeader}
                chapters={frontmatter.tocInHeader && chapters}
                isChapterIndexVisible={frontmatter.tocInHeader && isChapterIndexVisible}>
          <div className="prose mx-auto book">
            {frontmatter.coverImg && (
              <div className="book-cover-img">
                <Image
                  width={650}
                  height={650}
                  layout={"responsive"}
                  alt={"cover image"}
                  src={`${relativePath}/${frontmatter.coverImg}`}
                />
              </div>
            )}

            { /* frontmatter.showQuizProgress && <QuizProgress /> */}

            <h1 className="max-w-sm mb-0 font-medium">{frontmatter.title}</h1>
            <p className="subtitle">{frontmatter.subTitle}</p>

            {mdxContent}

            {!frontmatter.tocInHeader &&
              <ContentIndexControl
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
                showQuizProgress={!!frontmatter.showQuizProgress}
                startSmall={!!frontmatter.indexInitiallyClosed}
              />
            }

            { /* frontmatter.requireLogin && frontmatter.logQuizzes && (
              <SubmitQuiz submitText={frontmatter.submitQuizText} />
            ) */}

            {chapters.map(
              ({ frontmatter: chapterFrontmatter, content }, index) => (
                <Chapter
                  key={chapterFrontmatter.title}
                  frontmatter={chapterFrontmatter}
                  content={content}
                  index={index}
                  setIsChapterIndexVisible={setIsChapterIndexVisible}
                  hideQuestions={!!frontmatter.hideQuestions}
                  chapterNumber={chapterNumbers[index]}
                />
              )
            )}
          </div>
        </Layout>
{ /*      </QuizContextProvider> */ }
    </IntlContextProvider>
  );
};
