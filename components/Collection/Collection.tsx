"use client";

import React from "react";
import { MdxContent } from "@/components/MdxContent";
import Link from "next/link";
import { getT, IntlContextProvider, useIntl } from "../../i18n";
import Layout from "../Layout/Layout";
import Image from "../Image";


import { CollectionProps, ItemDesc } from "@/api/BookService";

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
  frontmatter,
  content,
  collections,
  books,
  slug,
}: CollectionProps) =>
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
          { content
            ? <MdxContent content={content} t={getT(frontmatter.language)}/>
            : !!frontmatter.subTitle &&
                <p className="subtitle">{frontmatter.subTitle}</p>
          }

          <List items={collections} title={slug && "collections"} />
          <List items={books} title="books" />
        </div>
      </Layout>
    </IntlContextProvider>;
