import React from "react";
import { MDXRemote } from "next-mdx-remote";
import Link from "next/link";
import {IntlContextProvider, useIntl} from "../../i18n";
import Layout from "../layout";
import Image from "../Image";
import CcByNcNd from "../Book/CcByNcNd";

const List = ({ items, title }) => {
  const {t} = useIntl();
  return !!items.length && <>
    { !!title && <h2 className="text-lg mt-8">{t(title)}</h2> }
    {items.map(({slug, frontmatter}) => (
      <div className="book" key={slug}>
        <Link legacyBehavior href={`/${slug}`}>
          <a>
            <h2>{frontmatter.title}</h2>
            {!!frontmatter.subTitle && <p>{frontmatter.subTitle}</p>}
          </a>
        </Link>
      </div>
    ))}
  </>;
}


export const Collection = ({ frontmatter, content, collections, books, slug }) => {
  const mdxContent = React.useMemo(
    () => <MDXRemote {...content} components={{ CcByNcNd }} />,
    [content],
  );
  return (
    <IntlContextProvider lang={frontmatter.language}>
      <Layout title={frontmatter.title}>
        <div className="series mx-auto">
          {frontmatter.coverImg && (
            <div className="book-cover-img">
              <Image
                width={650}
                height={650}
                layout={"responsive"}
                alt={"cover image"}
                src={`/${slug}/${frontmatter.coverImg}`}
              />
            </div>
          )}
          
          <h1 className="mb-0 font-medium">{frontmatter.title}</h1>
          {!!frontmatter.subTitle && (
            <p className="subtitle">{frontmatter.subTitle}</p>
          )}

          {mdxContent}

          <List items={collections} title={slug && "collections"} />
          <List items={books} title="books" />

        </div>
      </Layout>
    </IntlContextProvider>
  );
};
