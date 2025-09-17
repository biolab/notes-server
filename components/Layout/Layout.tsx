import React from "react";
import Link from "next/link";
import { IconContext } from "react-icons";
import { ImHome, ImList2 } from "react-icons/im";

import { useIntl } from "@/i18n";
import { ChapterDef } from "@/types";

import { ContentIndex } from "./ContentIndex";
import UserDropdown from "./UserDropdown";


export const HomeIcon = () => {
  const { t } = useIntl();

  return (
    <IconContext.Provider value={{ className: "home-icon" }}>
      <Link href="/" passHref>
        <ImHome title={t("book.home")} />
      </Link>
    </IconContext.Provider>
  );
};

export default function Layout({
  title = null,
  isAdmin = false,
  showHome = false,
  collection = null,
  chapters = [],
  isChapterIndexVisible = {},
  showLinkToResults = false,
  onChangeShowAnswers,
  returnLink,
  children,
}: {
  title: string | null;
  showHome?: boolean;
  collection?: { title: string, href: string} | null,
  isAdmin?: boolean;
  chapters?: ChapterDef[];
  isChapterIndexVisible?: { [key: number]: boolean };
  showLinkToResults?: boolean;
  onChangeShowAnswers?: (show: boolean) => void;
  returnLink?: string;
  children: React.ReactNode;
}) {
  const titleLink = React.useMemo(() => title &&
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        window.scrollTo({top: 0, behavior: "smooth"});
      }}
      title={title}
      className="block w-full"
    >
      {title}
    </a>,
    [title]
  );

  return (
    <div className="flex flex-col min-h-screen mt-14">
      <header className="main-header">
        <div className="flex justify-between items-center min-w-0 gap-3">
          {showHome ? <HomeIcon/>
            : chapters.length ? (
              <div className="header-content-index">
                <ImList2 style={{ marginRight: "4em" }} />
              <ContentIndex
                className="content-index-at-header prose"
                contentTitle={title!}
                chapters={chapters}
                isChapterIndexVisible={isChapterIndexVisible}
                // TODO
                // showQuizProgress={false}
              />
            </div>
            ) : <div />
          }
          { collection &&
            <div className="min-w-0 flex-1 text-right">
              <a href={collection.href}
                 title={collection.title}
                 className="block truncate">{collection.title}</a>
            </div>
          }
        </div>
        <div className="justify-self-center">
          { collection ? "—" :
           <span className="page-title">
             {titleLink}
           </span>
          }
        </div>
        <div className={`flex ${collection && title ? "justify-between items-center min-w-0 gap-3" : "justify-end"}`}>
          {collection && titleLink &&
            <div className="min-w-0 flex-1 truncate text-left">
               {titleLink}
            </div>
          }
          <div className="flex">
            <UserDropdown
              showLinkToResults={showLinkToResults}
              returnLink={returnLink}
              isAdmin={isAdmin}
              onChangeShowAnswers={onChangeShowAnswers}
            />
          </div>
        </div>
      </header>
      <main className="container mx-auto flex-1">{children}</main>
    </div>
  );
}
