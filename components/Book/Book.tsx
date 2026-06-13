"use client";

import React, { useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "../Image";
import { toast } from "react-toastify";

import { AnswersInBook, CorrectAnswers, getLastAnswers, getAnswersInBook } from "@/api/quiz";
import { BookProps, getPublicCollection } from "@/api/book";
import { isAdminFor } from "@/api/user";

import { logger } from "@/utils/logger";
import { getT, IntlContextProvider, useIntl } from "@/i18n";
import { UserContext } from "@/context/UserContextProvider";
import { AnswerState, QuizContext, QuizContextProvider } from "@/context/QuizContextProvider";
import Layout from "../Layout/Layout";

import Login from "../Login";
import { MdxContent } from "../MdxContent";
import { ContentIndexControl } from "../Layout/ContentIndex";
import { Chapter } from "./Chapter";
import { SidenoteContext } from "@/components/Book/Sidenote";
import { useHasMounted } from "@/hooks/useHasMounted";
import { usePublicProvider } from "@/hooks/usePublicProvider";
import { ChapterDef, LinkDesc, UnlockChaptersOnAnswersType } from "@/types";
import { initCopyButtons } from "@/utils/copyToClipboard";


const Chapters = ({chapters: allChapters, bookId, chapterNumbers, unlockChaptersOnAnswers, env, setIsChapterIndexVisible, allAnswers}:
  {chapters: ChapterDef[],
    bookId: number,
    chapterNumbers: Record<number, number>,
    unlockChaptersOnAnswers: UnlockChaptersOnAnswersType,
    env: Record<string, any>,
    setIsChapterIndexVisible: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
    allAnswers?: AnswersInBook}
) => {
  const {chapterStats} = useContext(QuizContext);
  const {t} = useIntl();
  const chapters = [];
  for(let index = 0; index < allChapters.length; index++) {
      chapters.push(allChapters[index]);
      const stats = chapterStats(index);
      if (unlockChaptersOnAnswers !== "none"
          && stats
          && stats.nQuestions != (unlockChaptersOnAnswers === "attempt" ? stats.answered : stats.correct)) {
        break;
      }
    }
  return <>
    {chapters.map((chapterDef, index) => (
      <Chapter
        {...chapterDef}
        bookId={bookId}
        chapterId={chapterDef.chapterId}
        key={chapterDef.chapterPath}
        index={index}
        setIsChapterIndexVisible={setIsChapterIndexVisible}
        chapterNumber={chapterNumbers[index]}
        env={env}
        allAnswers={allAnswers}
      />
    ))}
    { allChapters.length !== chapters.length &&
      <div className="chapter locked">
        <h2>{t("book.locked-chapter")}</h2>
        <p>{unlockChaptersOnAnswers === "attempt"
             ? t("book.locked-chapter-msg-attempt")
             : t("book.locked-chapter-msg-correct")}</p>
      </div>
    }
  </>
}

export const Book = (
  { frontmatter, content, chapters, slug, bookId, previous, next }: BookProps
) => {
  const [isChapterIndexVisible, setIsChapterIndexVisible] = useState({});
  const relativePath = React.useMemo(() => `/${slug}`, [slug]);
  const { user, userGroup, setUserGroup } = useContext(UserContext);
  const [ isAdmin, setIsAdmin ] = useState<boolean>(false);
  const [answers, setAnswers] =
    useState<"pending" | null | {
      answers: AnswerState[],
      correctAnswers: CorrectAnswers}>("pending");
  const hasGroups = useMemo(() => frontmatter.groups.length > 0, [frontmatter]);
  const [groupRequired, setGroupRequired] = useState<boolean | null>(null);
  const hasQuestions = useMemo(
    () => chapters.some((chapter) => chapter.questions.length > 0),
    [chapters]
  );

  const t = useMemo(
    () => getT(frontmatter.language || "en"),
    [frontmatter.language]);

  const [allAnswers, setAllAnswers] = useState<AnswersInBook | false>(false);

  /* Restore previous answers */
  React.useEffect(() => {
    if (!user
      || hasGroups && !userGroup
    ) {
      return;
    }
    getLastAnswers({ accessToken: user.accessToken, bookId, group: userGroup})
      .then((response) => {
        logger("Quiz answers fetched:", response);
        setAnswers(response);
      })
      .catch((error) => {
        toast.error(error.message || t("quiz.fetch-answers-error"));
        setAnswers(null);
      });

    if (user.admin) {
      setIsAdmin(true);
    }
    else {
      isAdminFor({accessToken: user.accessToken, bookId}).then(setIsAdmin);
    }

    getAnswersInBook(bookId, user.accessToken).then(setAllAnswers);
  }, [t, user, user?.accessToken, userGroup, slug, bookId, hasGroups]);

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
    if (!user) {
      return;
    }
    if (!hasGroups) {
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

        // Is the intersection of book's and user's groups (with proper tokens)
        // a single group?
        const applicable = frontmatter.groups.filter(([group, token]) =>
          Object.values(user.groups).includes(group)
          && (!token || user.tokens?.includes(token))
        );
        if (applicable.length === 1) {
          setUserGroup(applicable[0][0]);
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
  [user, frontmatter, bookId, hasGroups, setUserGroup]);

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

  const [publicCollection, setPublicCollection] = useState<LinkDesc | null>(null);
  React.useEffect(() => {
    getPublicCollection(bookId).then(setPublicCollection);
  }, [bookId]);

  const publicProvider = usePublicProvider(slug);
  const homeLink = React.useMemo(() => (
    publicCollection
    || slug.includes("/") && publicProvider
    || {href: "/", title: ""}),
    [publicCollection, slug, publicProvider]);

  const loading = React.useMemo(() =>
      !user
      || groupRequired === null
      || publicCollection === null // prevent showing it later -- looks weird
      || publicProvider === null,
    [user, groupRequired, publicCollection, publicProvider]);

  const needsLogin = React.useMemo(() =>
    user && (frontmatter.requireLogin && !user.email || groupRequired),
    [user, frontmatter, groupRequired]);

  const { layout } = useContext(SidenoteContext);
  const hasMounted = useHasMounted();
  React.useEffect(() => {
    if (hasMounted && layout && !loading && !needsLogin && answers !== "pending") {
      layout();
    }
  }, [hasMounted, layout, loading, needsLogin, answers]);

  React.useEffect(() => {
    if (layout) {
      window.addEventListener("resize", layout);
      return () => window.removeEventListener("resize", layout);
    }
  }, [layout]);

  // Expressive code insert scripts into mdx, which are not executed,
  // so we imitate what they would do.
  React.useEffect(() => {
    const run = () => {
      initCopyButtons(document);

      document.querySelectorAll('.expressive-code pre').forEach((el) => {
        // reading these forces layout flush
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.scrollWidth;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientWidth;
      })
      window.dispatchEvent(new Event('resize'));
    }
    run();
    const obs = new MutationObserver(() => { run(); })
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // If there are no chapters, ensure enough space for any side notes in intro.
  // Doing this in presence of chapters would increase the left margin too much;
  // let us assume that books with chapters don't have side notes in intro.
  const marginClass = React.useMemo(
    () => chapters.length ? "mx-auto" : "mx-l320",
    [chapters]
  );

  if (needsLogin) {
    return (
      <Login
        title={frontmatter.title}
        slug={slug}
        bookId={bookId}
        requireEmail={frontmatter.requireLogin}
        groups={groupRequired ? frontmatter.groups : undefined}
        t={t}
      />
    );
  }

  if (loading || answers === "pending") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <IntlContextProvider lang={frontmatter.language || "en"}>
      <QuizContextProvider
        bookId={bookId}
        chapters={chapters}
        answers={answers?.answers || null}
        correctAnswers={answers?.correctAnswers || []}
        quizThreshold={frontmatter.quizThreshold || 0}
      >
        <Layout
          title={frontmatter.title}
          isAdmin={isAdmin}
          home={homeLink}
          collection={publicCollection || false}
          chapters={frontmatter.tocInHeader ? chapters : []}
          next={next}
          previous={previous}
          isChapterIndexVisible={
            frontmatter.tocInHeader ? isChapterIndexVisible : []
          }
          showLinkToResults={isAdmin && hasQuestions}
          onChangeGroup={userGroup ? () => { setUserGroup(null); setGroupRequired(true) } : undefined}
          onChangeShowAnswers={(isAdmin && hasQuestions) ? setShowAnswers : undefined}>
          <div className={`prose book ${marginClass}`}>
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

            <h1 className="mb-0 font-medium">{frontmatter.title}</h1>
            <p className="subtitle">{frontmatter.subTitle}</p>

            <MdxContent content={content} bookId={bookId} t={t} env={frontmatter.env}/>

            {!frontmatter.tocInHeader && chapters.length > 1 &&
              <ContentIndexControl
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
              />
            }

            <Chapters
              chapters={chapters}
              bookId={bookId}
              chapterNumbers={chapterNumbers}
              unlockChaptersOnAnswers={frontmatter.unlockChaptersOnAnswers}
              env={frontmatter.env}
              setIsChapterIndexVisible={setIsChapterIndexVisible}
              allAnswers={showAnswers && allAnswers || undefined}
              />
            { !!next && <a href={next.href} className="next-book-link">
              {t("book.next-in-collection")}{next.title}</a>
              }
          </div>
        </Layout>
      </QuizContextProvider>
    </IntlContextProvider>
  );
};
