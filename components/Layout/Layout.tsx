import React from "react";
import Link from "next/link";
import { IconContext } from "react-icons";
import { ImHome, ImList2 } from "react-icons/im";

import { ChapterDef } from "@/types";
import { LinkDesc } from "@/api/content";
import { useIntl } from "@/i18n";

import { QuizProgressBar } from "@/components/Layout/QuizProgress";
import { QuizContext } from "@/context/QuizContextProvider";
import { UserContext } from "@/context/UserContextProvider";
import { ContentIndex } from "./ContentIndex";
import UserDropdown from "./UserDropdown";


export const HomeIcon = ({link}: {link: LinkDesc}) =>
  !!link &&
    <IconContext.Provider value={{ className: "home-icon" }}>
      <Link href={link.href} passHref>
        <ImHome title={link.title} />
      </Link>
    </IconContext.Provider>

export default function Layout({
  title = null,
  isAdmin = false,
  home = false,
  collection = false,
  chapters = [],
  isChapterIndexVisible = {},
  showLinkToResults = false,
  onChangeShowAnswers,
  returnLink,
  children,
}: {
  title: string | null;
  home?: LinkDesc;
  collection?: LinkDesc,
  isAdmin?: boolean;
  chapters?: ChapterDef[];
  isChapterIndexVisible?: { [key: number]: boolean };
  showLinkToResults?: boolean;
  onChangeShowAnswers?: (show: boolean) => void;
  returnLink?: string;
  children: React.ReactNode;
}) {
  const { t } = useIntl();
  const { user } = React.useContext(UserContext);

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

  const { correct, answered, wrong, nQuestions, threshold } =
    React.useContext(QuizContext);

  return (
    <div className="flex flex-col min-h-screen mt-14">
      <header className="main-header">
        <div className="flex justify-between items-center min-w-0 gap-3">
          <div className="flex flex-row gap-5">
            {home && <HomeIcon link={home}/> }
            { chapters.length > 0 &&
              <div className="header-content-index flex items-center">
                <ImList2 />
                <ContentIndex
                  className="content-index-at-header prose"
                  contentTitle={title!}
                  chapters={chapters}
                  isChapterIndexVisible={isChapterIndexVisible}
                />
              </div>
            }
            { nQuestions > 0 &&
              <div style={{width: "100px", display: "flex", flexDirection: "column", justifyContent: "center"}}>
                <QuizProgressBar
                  correct={correct}
                  answered={answered}
                  wrong={wrong}
                  nQuestions={nQuestions}
                  threshold={threshold}/>
              </div>
            }
          </div>
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
          <div className="flex flex-row gap-5">
            { user?.email || t("user.anonymous-user") }
            <div className="flex">
              <UserDropdown
                showLinkToResults={showLinkToResults}
                returnLink={returnLink}
                isAdmin={isAdmin}
                onChangeShowAnswers={onChangeShowAnswers}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex-1">{children}</main>
    </div>
  );
}
