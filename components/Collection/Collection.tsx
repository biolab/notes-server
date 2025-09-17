"use client";

import React, { useState } from "react";
import Link from "next/link";
import Layout from "../Layout/Layout";
import Image from "../Image";

import { getPublicCollection, CollectionProps } from "@/api/collection";
import { ItemDesc, LinkDesc } from "@/api/content";
import { getCollectionHasQuestions } from "@/api/quiz";
import { isAdminFor } from "@/api/user";
import { getT, IntlContextProvider, useIntl } from "@/i18n";
import { UserContext } from "@/context/UserContextProvider";
import { MdxContent } from "@/components/MdxContent";
import { usePublicProvider } from "@/hooks/usePublicProvider";


const List = ({items, title}: { title: string; items: ItemDesc[] }) => {
  const { t } = useIntl();
  return (
    !!items.length && (
      <>
        {!!title && <h2 className="text-lg mt-8">{t(title)}</h2>}
        {items.map(({ slug, title, subtitle }) => (
          <div className="book" key={slug}>
            <Link href={`/${slug}`}>
              <h2>{title}</h2>
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

  const provider = usePublicProvider(slug);
  const [publicCollection, setPublicCollection] = useState<LinkDesc | null>(null);
  React.useEffect(() => {
    getPublicCollection(collectionId).then(setPublicCollection);
  }, [collectionId]);

  const loading = React.useMemo(() =>
      publicCollection === null // prevent showing it later -- looks weird
      || provider === null,
    [publicCollection, provider]);

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
      home={provider || false}
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
        <List items={books} title="books"/>
      </div>
    </Layout>
  </IntlContextProvider>;
}
