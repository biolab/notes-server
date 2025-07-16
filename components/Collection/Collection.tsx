"use client";

import React from "react";
import { MdxRenderer } from "../MdxRenderer";
import Link from "next/link";
import { IntlContextProvider, useIntl } from "../../i18n";
import Layout from "../Layout/Layout";
import Image from "../Image";
import { CollectionProps } from "@/utils/getCollectionProps";

const List = ({
  items,
  title,
}: {
  items: { slug: string; frontmatter: { title: string; subTitle?: string } }[];
  title: string;
}) => {
  const { t } = useIntl();
  return (
    !!items.length && (
      <>
        {!!title && <h2 className="text-lg mt-8">{t(title)}</h2>}
        {items.map(({ slug, frontmatter }) => (
          <div className="book" key={slug}>
            <Link href={`/${slug}`}>
              <h2>{frontmatter.title}</h2>
              {!!frontmatter.subTitle && <p>{frontmatter.subTitle}</p>}
            </Link>
          </div>
        ))}
      </>
    )
  );
};

export const Collection = ({
  frontmatter,
  content,
  collections,
  books,
  slug,
}: CollectionProps) => {
  return (
    <IntlContextProvider lang={frontmatter.language}>
      <Layout title={frontmatter.title}>
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
          {!!frontmatter.subTitle && (
            <p className="subtitle">{frontmatter.subTitle}</p>
          )}

          <MdxRenderer content={content} />

          <List items={collections} title={slug && "collections"} />
          <List items={books} title="books" />
        </div>
      </Layout>
    </IntlContextProvider>
  );
};
