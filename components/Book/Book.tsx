"use client";

import React, { useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "../Image";
import { toast } from "react-toastify";

import { AnswersInBook, getAnswers, getAnswersInBook } from "@/api/quiz";
import { BookProps } from "@/api/book";
import { isAdminFor } from "@/api/user";

import { logger } from "@/utils/logger";
import { IntlContextProvider, useIntl } from "@/i18n";
import { UserContext } from "@/context/UserContextProvider";
import { AnswerWithQuestionId, QuizContextProvider } from "@/context/QuizContextProvider";
import Layout from "../Layout/Layout";

import Login from "../Login";
import { MdxContent } from "../MdxContent";
import { ContentIndexControl } from "../Layout/ContentIndex";
import { Chapter } from "./Chapter";
import { SidenoteContext } from "@/components/Book/Sidenote";
import { useHasMounted } from "@/hooks/useHasMounted";


export const Book = ({ frontmatter, content, chapters, slug, bookId }: BookProps
) => {
  const [isChapterIndexVisible, setIsChapterIndexVisible] = useState({});
  const relativePath = React.useMemo(() => `/${slug}`, [slug]);
  const { user, setUserGroup } = useContext(UserContext);
  const [ isAdmin, setIsAdmin ] = useState<boolean>(false);
  const [answers, setAnswers] =
    useState<"pending" | null | AnswerWithQuestionId[]>("pending");
  const [groupRequired, setGroupRequired] = useState<boolean | null>(null);
  const hasQuestions = useMemo(
    () => chapters.some((chapter) => chapter.questions.length > 0),
    [chapters]
  );

  const { t } = useIntl();

  const [allAnswers, setAllAnswers] = useState<AnswersInBook | false>(false);

  const loading = React.useMemo(() =>
    !user || groupRequired === null || answers === "pending",
  [user, groupRequired, answers]);

  /* Restore previous answers */
  React.useEffect(() => {
    if (!user) {
      return;
    }
    // Do we need to include a group here as well?
    getAnswers({ accessToken: user.accessToken, bookId })
      .then((_answers) => {
        logger("Quiz answers fetched:", _answers);
        setAnswers(_answers);
      })
      .catch((error) => {
        toast.error(error.message || "Failed to fetch quiz answers");
        setAnswers(null);
      });

    if (user.admin) {
      setIsAdmin(true);
    }
    else {
      isAdminFor({accessToken: user.accessToken, bookId}).then(setIsAdmin);
      isAdminFor({accessToken: user.accessToken, bookId}).then(console.log);
    }

    getAnswersInBook(bookId, user.accessToken).then(setAllAnswers);
  }, [user, user?.accessToken, slug, bookId]);

  const [showAnswers, setShowAnswers] = useState(false);

  const chapterNumbers = React.useMemo(
    () =>
      Object.fromEntries(
        Array.from(chapters.entries())
          .filter(([, chapter]) => !chapter.frontmatter.omitAsChapter)
          .map(([index], i) => [index, i + 1])
      ),
    [chapters]
  );

  /* Determine and set the group;
     If there is no matching group or token, set groupRequired
  */
  React.useEffect(() => {
    if (!user || !frontmatter.groups || frontmatter.groups.length === 0) {
      setUserGroup(null);
      setGroupRequired(false);
      return;
    }

    if (frontmatter.groups[0][0] !== null) {
      // We need a group and possibly a token

      // Has the user read this book before and has a proper token?
      const storedGroup = user.groups[bookId];
      if (storedGroup) {
        if (frontmatter.groups.some(([group, token]) =>
          group === storedGroup
          && (!token || user.tokens?.includes(token))
        )) {
          setUserGroup(storedGroup);
          setGroupRequired(false);
          return;
        }
      } else {

        // Is the intersection of book's and users's groups (with proper tokens)
        // a single group?
        const applicable = frontmatter.groups.filter(([group, token]) =>
          Object.values(user.groups).includes(group)
          && (!token || user.tokens?.includes(token))
        );
        if (applicable.length === 1) {
          setUserGroup(storedGroup);
          setGroupRequired(false);
          return;
        }
      }
    }
    else {
      // We only need a token
      if (frontmatter.groups.some(([, token]) =>
        !token || user.tokens?.includes(token))
      ) {
        setUserGroup(null);
        setGroupRequired(false);
        return;
      }
    }

    setGroupRequired(true);
  },
  [user, frontmatter, bookId, setUserGroup]);

  const pathname = usePathname();
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [pathname]);

  const { layout } = useContext(SidenoteContext);
  const hasMounted = useHasMounted();
  React.useEffect(() => {
    if (hasMounted && layout) {
      layout();
    }
  }, [hasMounted, layout]);

  React.useEffect(() => {
    if (layout) {
      window.addEventListener("resize", layout);
      return () => window.removeEventListener("resize", layout);
    }
  }, [layout]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  if (frontmatter.requireLogin && !user!.email || groupRequired) {
    return (
      <Login
        title={frontmatter.title}
        bookId={bookId}
        requireEmail={frontmatter.requireLogin}
        groups={groupRequired ? frontmatter.groups : undefined}
      />
    );
  }

  return (
    <IntlContextProvider lang={frontmatter.language || "en"}>
      <QuizContextProvider
        bookId={bookId}
        chapters={chapters}
        answers={answers as AnswerWithQuestionId[] | null}
        quizThreshold={frontmatter.quizThreshold || 0.8}
      >
        <Layout
          title={frontmatter.title}
          isAdmin={isAdmin}
          showHome={!frontmatter.tocInHeader}
          chapters={frontmatter.tocInHeader ? chapters : []}
          isChapterIndexVisible={
            frontmatter.tocInHeader ? isChapterIndexVisible : []
          }
          showLinkToResults={isAdmin && hasQuestions}
          onChangeShowAnswers={(isAdmin && hasQuestions) ? setShowAnswers : undefined}>
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

            <MdxContent content={content} bookId={bookId} t={t}/>

            {!frontmatter.tocInHeader && (
              <ContentIndexControl
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
              />
            )}

            {chapters.map((chapterDef, index) => (
              <Chapter
                {...chapterDef}
                bookId={bookId}
                chapterId={chapterDef.chapterId}
                key={chapterDef.chapterDir}
                index={index}
                setIsChapterIndexVisible={setIsChapterIndexVisible}
                chapterNumber={chapterNumbers[index]}
                allAnswers={showAnswers && allAnswers || undefined}
              />
            ))}
          </div>
        </Layout>
      </QuizContextProvider>
    </IntlContextProvider>
  );
};
