"use client";

import React, { useState } from "react";
import Link from "next/link";
import Layout from "../Layout/Layout";
import Image from "../Image";

import { getPublicCollection, CollectionProps } from "@/api/collection";
import { ItemDesc } from "@/api/content";
import { CollectionStats, getCollectionHasQuestions, getUserCollectionStats } from "@/api/quiz";
import { isAdminFor } from "@/api/user";
import { getT, IntlContextProvider, useIntl } from "@/i18n";
import { UserContext } from "@/context/UserContextProvider";
import { MdxContent } from "@/components/MdxContent";
import { usePublicProvider } from "@/hooks/usePublicProvider";
import { QuizProgressBar } from "@/components/Layout/QuizProgress";
import { LinkDesc } from "@/types";


const List = ({items, title, quizStats}: {
  title: string;
  items: ItemDesc[];
  quizStats?: Record<number, CollectionStats> | null;
}) => {
  const { t } = useIntl();
  return (
    !!items.length && (
      <>
        {!!title && <h2 className="text-lg mt-8">{t(title)}</h2>}
        {items.map(({ slug, id, title, subtitle }) => (
          <div className="book" key={slug}>
            <Link href={`/${slug}`}>
              <h2>
                {!!quizStats && (quizStats[id]?.nQuestions ?? 0) > 0 &&
                  <div style={{float: "right", width: "100px"}}>
                    <QuizProgressBar {...quizStats[id]} />
                  </div>
                }
                {title}
              </h2>
              {!!subtitle && <p>{subtitle}</p>}
            </Link>
          </div>
        ))}
      </>
    )
  );
};

export const Collection = ({
  collectionId,
  frontmatter,
  content,
  collections,
  books,
  slug,
}: CollectionProps) => {
  const [hasQuestions, setHasQuestions] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    getCollectionHasQuestions(collectionId).then(setHasQuestions);
  },
  [collectionId]);

  const { user } = React.useContext(UserContext);
  const [ isAdmin, setIsAdmin ] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!user) {
      return;
    }
    if (user.admin) {
      setIsAdmin(true);
    }
    else {
      isAdminFor({accessToken: user.accessToken, collectionId}).then(setIsAdmin);
    }
  },
  [user, collectionId]);

  const [publicCollection, setPublicCollection] = useState<LinkDesc | null>(null);
  React.useEffect(() => {
    getPublicCollection(collectionId).then(setPublicCollection);
  }, [collectionId]);

  const [collectionStats, setCollectionStats] = useState<Record<string, CollectionStats> | null | undefined>(undefined);
  React.useEffect(() => {
    if (!user) {
      return;
    }
    getUserCollectionStats(user.accessToken, collectionId).then(setCollectionStats);
  }, [user, collectionId]);

  const publicProvider = usePublicProvider(slug);
  const homeLink = React.useMemo(() => (
      publicCollection
      || slug.includes("/") && publicProvider
      || {href: "/", title: ""}),
    [publicCollection, slug, publicProvider]);

  const loading = React.useMemo(() =>
      publicCollection === null // prevent showing it later -- looks weird
      || publicProvider === null
      || collectionStats === null,
    [collectionStats, publicCollection, publicProvider]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return <IntlContextProvider lang={frontmatter.language}>
    <Layout
      title={frontmatter.title}
      showLinkToResults={isAdmin && !!hasQuestions}
      isAdmin={isAdmin}
      home={homeLink}
      collection={publicCollection || false}
    >
      <div className="collection mx-auto">
        {frontmatter.coverImg && (
          <div className="book-cover-img">
            <Image
              width={650}
              height={650}
              layout="responsive"
              alt="cover image"
              src={`/${slug}/${frontmatter.coverImg}`}
            />
          </div>
        )}

        <h1 className="mb-0 font-medium">{frontmatter.title}</h1>
        {content
         ? <MdxContent content={content} t={getT(frontmatter.language)}/>
         : !!frontmatter.subTitle &&
           <p className="subtitle">{frontmatter.subTitle}</p>
        }

        <List items={collections} title={slug && "collections"}/>
        <List items={books} title="books" quizStats={collectionStats ?? null}/>
      </div>
    </Layout>
  </IntlContextProvider>;
}
