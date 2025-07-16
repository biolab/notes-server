import Link from "next/link";
import { IconContext } from "react-icons";
import { ImHome, ImList2 } from "react-icons/im";
import { useIntl } from "../../i18n";
import { ContentIndex } from "../Book/ContentIndex";
import React from "react";
import { ChapterDef } from "@/types/types";
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
  showHome = false,
  chapters = [],
  isChapterIndexVisible = {},
  children,
}: {
  title: string | null;
  showHome?: boolean;
  chapters?: ChapterDef[];
  isChapterIndexVisible?: { [key: number]: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen mt-14">
      <header className="main-header">
        {showHome ? (
          <HomeIcon />
        ) : chapters.length ? (
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
        ) : (
          <div />
        )}
        <span className="page-title">{title}</span>
        <UserDropdown />
      </header>
      <main className="container mx-auto flex-1">{children}</main>
    </div>
  );
}
