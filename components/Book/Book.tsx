"use client";

import React, { useContext, useState } from "react";
import Image from "../Image";
import { MdxContent } from "../MdxContent";
import { Chapter } from "./Chapter";
import { ContentIndexControl } from "./ContentIndex";
import { IntlContextProvider } from "@/i18n";
import { BookProps } from "@/utils/getBookProps";
import {
  IAnswerValue,
  QuizContextProvider,
} from "@/context/QuizContextProvider";
import { UserContext } from "@/context/UserContextProvider";
import { QuizService_GetAnswers } from "@/server-functions/QuizService";
import BookLogin from "./BookLogin";
import { logger } from "@/utils/logger";
import Layout from "../Layout/Layout";

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
  const [answers, setAnswers] = useState<"pending" | null | IAnswerValue[]>(
    "pending"
  );

  logger("Book component mounted with slug:", slug);

  const loading = retrievingUser || answers === "pending";

  React.useEffect(() => {
    if (retrievingUser) {
      return;
    }

    if (!user) {
      setAnswers(null);
      return;
    }

    const fetchState = async () => {
      const _answers = await QuizService_GetAnswers({
        user,
        bookId: bookId!,
      });

      logger("Quiz answers fetched:", _answers);

      setAnswers(_answers);
    };

    fetchState();
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
        chapters={chapters}
        title={frontmatter.title}
        answers={answers as IAnswerValue[] | null}
        slug={slug}
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

            <MdxContent content={content} />

            {!frontmatter.tocInHeader && (
              <ContentIndexControl
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
                startSmall={!!frontmatter.indexInitiallyClosed}
              />
            )}

            {chapters.map((chapterDef, index) => (
              <Chapter
                {...chapterDef}
                bookId={bookId!}
                key={chapterDef.frontmatter.title}
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
