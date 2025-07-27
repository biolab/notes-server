"use client";

import React, { useContext, useState } from "react";
import Image from "../Image";
import { MdxContent } from "../MdxContent";
import { Chapter } from "./Chapter";
import { ContentIndexControl } from "./ContentIndex";
import { IntlContextProvider, useIntl } from "@/i18n";
import { AnswerWithQuestionId, QuizContextProvider
} from "@/context/QuizContextProvider";
import { UserContext } from "@/context/UserContextProvider";
import { getAnswers } from "@/api/QuizService";
import BookLogin from "./BookLogin";
import { logger } from "@/utils/logger";
import Layout from "../Layout/Layout";
import { toast } from "react-toastify";

import { BookProps } from "@/api/BookService";

export const Book = ({
  frontmatter,
  content,
  chapters,
  slug,
  bookId,
}: BookProps) => {
  const [isChapterIndexVisible, setIsChapterIndexVisible] = useState({});
  const relativePath = React.useMemo(() => `/${slug}`, [slug]);
  const { user, retrievingUser, showLogin } = useContext(UserContext);
  const [answers, setAnswers] = useState<"pending" | null | AnswerWithQuestionId[]>(
    "pending"
  );

  const { t } = useIntl();

  const loading = retrievingUser || answers === "pending";

  React.useEffect(() => {
    if (retrievingUser) {
      return;
    }

    if (!user) {
      setAnswers(null);
      return;
    }

    // todo: doesn't bookId always exist?
    getAnswers({ user, bookId: bookId! })
      .then((_answers) => {
        logger("Quiz answers fetched:", _answers);
        setAnswers(_answers);
      })
      .catch((error) => {
        toast.error(error.message || "Failed to fetch quiz answers");
        setAnswers(null);
      });
  }, [user, retrievingUser, slug, bookId]);

  const chapterNumbers = React.useMemo(
    () =>
      Object.fromEntries(
        Array.from(chapters.entries())
          .filter(([, chapter]) => !chapter.frontmatter.omitAsChapter)
          .map(([index], i) => [index, i + 1])
      ),
    [chapters]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <BookLogin
        title={frontmatter.title}
        emailContent={frontmatter.email}
        loginSubtitle={frontmatter.loginSubtitle}
      />
    );
  }

  return (
    <IntlContextProvider lang={frontmatter.language || "en"}>
      <QuizContextProvider
        bookId={bookId!}
        chapters={chapters}
        answers={answers}
        quizThreshold={frontmatter.quizThreshold || 0.8}
      >
        <Layout
          title={frontmatter.title}
          showHome={!frontmatter.tocInHeader}
          chapters={frontmatter.tocInHeader ? chapters : []}
          isChapterIndexVisible={
            frontmatter.tocInHeader ? isChapterIndexVisible : []
          }
        >
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

            <h1 className="max-w-sm mb-0 font-medium">{frontmatter.title}</h1>
            <p className="subtitle">{frontmatter.subTitle}</p>

            <MdxContent content={content} bookId={bookId!} t={t}/>

            {!frontmatter.tocInHeader && (
              <ContentIndexControl
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
              />
            )}

            {chapters.map((chapterDef, index) => (
              <Chapter
                {...chapterDef}
                bookId={bookId!}
                chapterId={chapterDef.chapterId}
                key={chapterDef.chapterDir}
                index={index}
                setIsChapterIndexVisible={setIsChapterIndexVisible}
                chapterNumber={chapterNumbers[index]}
              />
            ))}
          </div>
        </Layout>
      </QuizContextProvider>
    </IntlContextProvider>
  );
};
