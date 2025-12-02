import React from "react";
import Link from "next/link";
import { IconContext } from "react-icons";
import { ImHome, ImList2, ImArrowLeft, ImArrowRight } from "react-icons/im";

import { ChapterDef, LinkDesc } from "@/types";
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
  previous = undefined,
  next = undefined,
  collection = false,
  chapters = [],
  isChapterIndexVisible = {},
  showLinkToResults = false,
  onChangeGroup,
  onChangeShowAnswers,
  returnLink,
  children,
}: {
  title: string | null;
  home?: LinkDesc;
  previous?: LinkDesc;
  next?: LinkDesc;
  collection?: LinkDesc,
  isAdmin?: boolean;
  chapters?: ChapterDef[];
  isChapterIndexVisible?: { [key: number]: boolean };
  showLinkToResults?: boolean;
  onChangeGroup?: () => void;
  onChangeShowAnswers?: (show: boolean) => void;
  returnLink?: string;
  children: React.ReactNode;
}) {
  const { t } = useIntl();
  const { user, userGroup } = React.useContext(UserContext);

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
            { chapters.length > 1 &&
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
          {collection && (
            <div className="min-w-0 text-right flex items-center whitespace-nowrap">
              {titleLink && previous && (
                <a href={`/${previous.href}`} className="mr-3 inline-flex items-center">
                  <ImArrowLeft />
                </a>
              )}

              <a
                href={collection.href}
                title={collection.title}
                className="truncate inline-block max-w-full align-middle"
              >
                {collection.title}
              </a>
            </div>
          )}
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
            <div className="min-w-0 flex flex-1 truncate text-left flex-nowrap items-center">
              <span className="inline-block min-w-0">{titleLink}</span>
              { next &&
                <a href={`/${next.href}`} className="ml-3 inline-flex">
                    <ImArrowRight />
                </a>
              }
            </div>
          }
          <div className="flex flex-row gap-5">
            <div title={user?.email || undefined}>
              { user?.name ? `${user?.name} ${user?.surname}` : user?.email || t("user.anonymous-user") }
              { !!userGroup && `, ${userGroup}`}
            </div>
            <div className="flex">
              <UserDropdown
                showLinkToResults={showLinkToResults}
                returnLink={returnLink}
                isAdmin={isAdmin}
                onChangeGroup={onChangeGroup}
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
