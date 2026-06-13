'use client';

import React from "react";
import { RiDownloadCloud2Line } from "react-icons/ri";

import {
  AnswersInBook, PointsInCollection, getAnswersInBook,
  getCollectionResults, UserDesc, AnswerRecord, getCollectionBooksWithQuestions
} from "@/api/quiz";
import { BookProps, getGroups as getBookGroups } from "@/api/book";
import { CollectionProps, getGroups as getCollectionGroups } from "@/api/collection";
import { GroupList, ItemDesc } from "@/api/content";
import { UserContext } from "@/context/UserContextProvider";
import { corrColor, corrSym } from "@/utils/questions";

import Layout from "../Layout/Layout";
import { useIntl } from "@/i18n";


function GroupsCombo({groups, value, onChange}: {
  groups: GroupList;
  value: number | null;
  onChange: (groupId: number | null) => void;
}) {
  return (
    <select
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      defaultValue={`${value}`}
    >
      <option value="">All groups</option>
      {groups.map(({id, name}) => (
        <option key={id} value={id}>{name}</option>
      ))}
    </select>
  );
}

export const TooltipWrapper = ({ children, tooltip }: {
  children: React.ReactNode;
  tooltip: React.ReactNode}
) =>
  <div className="relative group inline-block">
    <div>{children}</div>
    <div className="tooltip">{tooltip}</div>
  </div>

function filterResults<T extends UserDesc>(results: T[] | false | null, group: number | null): T[] | false | null
{
  return group && results
         ? results.filter(({groupId}) => groupId === group)
         : results;
}

const classForPoints = (points: number | undefined, threshold: number | null | undefined) =>
  (points === undefined || !threshold) ? ""
  : points < threshold ? "failed" : "passed";


export function BookResults({bookId, slug, frontmatter, chapters}: BookProps) {
  const {t} = useIntl();
  const {user} = React.useContext(UserContext);
  const [results, setResults] = React.useState<AnswersInBook | false | null>(null);
  React.useEffect(() => {
      if (user) {
        getAnswersInBook(bookId, user.accessToken || "").then(setResults);
      }
    },
    [user, user?.accessToken, bookId]);

  const [groups, setGroups] = React.useState<GroupList>([]);
  React.useEffect(() => {
      getBookGroups(bookId).then(setGroups);
    },
    [bookId]);

  const questions = React.useMemo(
    () => chapters.flatMap(({questions}) => questions),
    [chapters]
  );
  const questionTypes = React.useMemo(
    () => Object.fromEntries(
      questions.map(({questionId, type}) => [questionId, type])),
    [questions]
  );
  const threshold = React.useMemo(
    () => (frontmatter.quizThreshold ?? 0) * questions.reduce((sum, {maxPoints}) => sum + (maxPoints || 0), 0),
    [questions, frontmatter.quizThreshold]
  );

  const [group, setGroup] = React.useState<number | null>(null);
  const filteredResults = React.useMemo(
    () => filterResults(results, group),
    [results, group]
  );

  const lastAttempt = (ars: AnswerRecord[]) => ars?.[ars.length - 1];

  const resultsWithTotals = React.useMemo(() => filteredResults && filteredResults.map((res) => ({
    ...res,
    total: questions
      .map(({questionId}) => res.answers[questionId!])
      .map((attempts) => lastAttempt(attempts)?.points || 0)
      .reduce((a: number, b) => a + b, 0)
  })), [filteredResults, questions]);

  const hasGroups = React.useMemo(() => groups?.length > 0, [groups]);

  const getGroupName = React.useCallback((groupId: number) =>
      groups.find((g) => g.id === groupId)?.name,
    [groups]
  );

  const hasUploadedFiles = React.useMemo(
    () => results && questions.some(({type, questionId}) =>
      (type === "upload" || type === "uploads")
      && results.some(({answers}) => answers[questionId]?.length)),
    [questions, results]);

  const downloadAsExcel = React.useMemo(() =>
    <p>
      <a href={`/quiz-results?bookId=${bookId}&accessToken=${user?.accessToken}${group ? `&groupId=${group}` : ""}`}>
        {t(hasUploadedFiles ? "results.download-as-zip" : "results.download-as-excel")}
      </a>
    </p>,
    [bookId, user?.accessToken, group, t, hasUploadedFiles]
  );

  if (results === false) {
    return <p>You do not have permission to view these results.</p>
  }

  if (!filteredResults || !groups) {
    return <p>Loading results...</p>
  }

  return (
    <Layout title={frontmatter.title} returnLink="Book">
      <div className="prose mx-auto admin-page">
        <div className="flex justify-between items-end">
          {hasGroups &&
            <GroupsCombo groups={groups} value={group} onChange={setGroup}/>
          }
        </div>
        {downloadAsExcel}
        <table className="tableAuto w-auto quiz-results">
          <thead>
          <tr>
            <td/>
            {questions.map(({id, question, questionId}) => (
              <th key={id} className="rotated">
                <a href={`/${slug}#question-${questionId}`}>
                  <TooltipWrapper tooltip={question}>
                    <div className="rotated">
                      {question}
                    </div>
                  </TooltipWrapper>
                </a>
              </th>
            ))}
            <th>
              {t("results.points")}
            </th>
          </tr>
          </thead>
          <tbody>
          {!resultsWithTotals || resultsWithTotals.length === 0
            ? <tr>
              <td>{t("results.no-answers")}</td>
            </tr>
            : resultsWithTotals.map(({userId, groupId, name, surname, email, answers, total}) => (
              <tr key={`${userId}-${groupId}`}>
                <th>
                  <TooltipWrapper
                    tooltip={
                      [email, hasGroups && `${t("results.group")}: ${getGroupName(groupId)}`]
                        .filter(Boolean)
                        .join("\n")}>
                    {name ? `${name} ${surname}` : `${t("results.user-nr")}${userId}`}
                  </TooltipWrapper>
                </th>
                {questions.map(({id: qId, questionId, question}) => {
                  const attempts = answers[questionId!];
                  if (!attempts || attempts.length === 0) {
                    return <td key={questionId}/>;
                  }
                  const {isCorrect} = attempts[attempts.length - 1];
                  return (
                    <td key={questionId}>
                      <TooltipWrapper
                        tooltip={<>
                          <p>{question}</p>
                          <ul style={{listStyleType: "none"}}>
                            {attempts.map(({isCorrect, answer, createdAt}, i) =>
                              <li key={i}>
                              <span style={{
                                color: corrColor(isCorrect),
                                fontWeight: "bold"
                              }}>
                                {corrSym(isCorrect)} {answer}&emsp;
                              </span>
                                <span style={{color: "#aaa", whiteSpace: "nowrap"}}>
                                ({new Date(createdAt).toLocaleString()})
                              </span>
                              </li>
                            )}
                          </ul>
                        </>}
                      >
                        {questionTypes[questionId].startsWith("upload")
                          ? <a
                            href={`/download-uploads?bookId=${bookId}&userId=${userId}&qId=${qId}&accessToken=${user?.accessToken}${group ? `&groupId=${group}` : ""}`}>
                            <RiDownloadCloud2Line className="inline-block align-middle"/>
                          </a>
                          : corrSym(isCorrect)
                        }
                      </TooltipWrapper>
                    </td>
                  );
                })}
                <th className={`total ${classForPoints(total, threshold)}`}>
                  {total}
                </th>
              </tr>
            ))}
          <tr>
            <th>N = {filteredResults.length}</th>
            {questions.map(({id, questionId, question}) =>
              <td key={`tot-${id}`}>
                <TooltipWrapper tooltip={question}>
                  {filteredResults
                    .map(({answers}) => lastAttempt(answers[questionId!])?.isCorrect ? 1 : 0)
                    .reduce((a: number, b) => a + b, 0)
                  }
                </TooltipWrapper>
              </td>
            )}
            <th style={{textAlign: "center"}}>
              {questions.flatMap(({questionId}) =>
                filteredResults
                  .map(({answers}) => lastAttempt(answers[questionId!])?.points || 0)
              ).reduce((a: number, b) => a + b, 0) / (filteredResults.length || 1)
              }
            </th>
          </tr>
          </tbody>
        </table>
      </div>
      {downloadAsExcel}
    </Layout>
  )
    ;
}

export function CollectionResults({collectionId, frontmatter, books}: CollectionProps) {
  const {t} = useIntl();
  const [results, setResults] = React.useState<PointsInCollection | false | null>(null);
  const {user} = React.useContext(UserContext);
  React.useEffect(() => {
      if (user) {
        getCollectionResults(collectionId, user?.accessToken || "").then(setResults);
      }
    },
    [user, user?.accessToken, collectionId]);

  const [groups, setGroups] = React.useState<GroupList>([]);
  React.useEffect(() => {
      getCollectionGroups(collectionId, true).then(setGroups);
    },
    [collectionId]);

  const [actBooks, setActBooks] = React.useState<ItemDesc[]>([]);
  const [thresholds, setThresholds] = React.useState<Record<number, number | null>>({});
  React.useEffect(() => {
      getCollectionBooksWithQuestions(collectionId).then((thresholds) => {
        setActBooks(books.filter(({id}) => thresholds[id] !== undefined));
        setThresholds(thresholds);
      });
    },
    [collectionId, books]);

  const pointsColorClass = React.useCallback((points: Record<number, number>, bookId: number) =>
    classForPoints(points[bookId], thresholds?.[bookId]),
    [thresholds]
  );

  const [group, setGroup] = React.useState<number | null>(null);
  const filteredResults = React.useMemo(
    () => filterResults(results, group),
    [results, group]
  );

  const hasGroups = React.useMemo(() => groups?.length > 0, [groups]);

  const downloadAsExcel = React.useMemo(() =>
    <p>
      <a
        href={`/quiz-collection-results?collectionId=${collectionId}&accessToken=${user?.accessToken}${group ? `&groupId=${group}` : ""}`}>
        {t("collection-results.download-as-excel")}
      </a>
    </p>,
    [collectionId, user?.accessToken, group, t]
  );

  if (results === false) {
    return <p>You do not have permission to view these results.</p>
  }

  if (!filteredResults || !groups) {
    return <p>Loading results...</p>
  }

  return (
    <Layout title={frontmatter.title} returnLink="Collection">
      <div className="prose mx-auto admin-page">
        <div className="flex justify-between items-end">
          <h2>Results for Collection &apos;{frontmatter.title}&apos;</h2>
          {hasGroups &&
            <GroupsCombo groups={groups} value={group} onChange={setGroup}/>
          }
        </div>
        {downloadAsExcel}
        <table className="tableAuto w-auto quiz-results">
          <thead>
          <tr>
            <td/>
            {actBooks.map(({title, slug}) => (
              <th
                key={slug}
                className="rotated"
                onClick={() => { window.location.href = `/${slug}?results`; }}
              >
                <TooltipWrapper tooltip={title}>
                  <div className="rotated">
                    {title}
                  </div>
                </TooltipWrapper>
              </th>
            ))}
            <th>
              Total
            </th>
          </tr>
          </thead>
          <tbody>
          {filteredResults.length === 0
            ? <tr>
              <td>No results</td>
            </tr>
            : filteredResults.map(({userId, groupId, name, surname, points}) => (
              <tr key={`${userId}-${groupId}`}>
                <th>{name ? `${name} ${surname}` : `User #${userId}`}</th>
                {actBooks.map(({id: bookId}) =>
                  <td key={bookId} className={`book-points ${pointsColorClass(points, bookId)}`}>
                    {points?.[bookId] ?? ""}
                  </td>
                )}
                <th className="total">
                  {Object.values(points || {}).reduce((a, b) => a + b, 0)}
                </th>
              </tr>
            ))
          }
          </tbody>
        </table>
      </div>
      {downloadAsExcel}
    </Layout>
  );
}
