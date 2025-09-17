'use client';

import React from "react";

import { AnswersInBook, PointsInCollection, getAnswersInBook,
         getCollectionResults, UserDesc,} from "@/api/quiz";
import { BookProps, getGroups as getBookGroups } from "@/api/book";
import { CollectionProps, getGroups as getCollectionGroups } from "@/api/collection";
import { GroupList } from "@/api/content";
import { UserContext } from "@/context/UserContextProvider";
import { corrColor, corrSym } from "@/utils/questions";

import Layout from "../Layout/Layout";


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

export function BookResults({bookId, slug, frontmatter, chapters}: BookProps) {
  const { user } = React.useContext(UserContext);
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

  const [group, setGroup] = React.useState<number | null>(null);
  const filteredResults = React.useMemo(
    () => filterResults(results, group),
    [results, group]
  );

  const hasGroups = React.useMemo(() => groups?.length > 0, [groups]);

  if (results === false) {
    return <p>You do not have permission to view these results.</p>
  }

  if (!filteredResults || !groups) {
    return <p>Loading results...</p>
  }

  return (
    <Layout title={frontmatter.title} returnLink="Book" >
      <div className="prose mx-auto admin-page">
        <div className="flex justify-between items-end">
          { hasGroups &&
            <GroupsCombo groups={groups} value={group} onChange={setGroup} />
          }
        </div>
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
              Points
            </th>
          </tr>
          </thead>
          <tbody>
          {filteredResults.length === 0
           ? <tr><td>No results</td></tr>
            : filteredResults.map(({userId, groupId, name, surname, email, answers}) => (
            <tr key={userId}>
              <th>
                <TooltipWrapper
                  tooltip={
                    [email, hasGroups && `Group: ${groups.find((g) => g.id === groupId)?.name}`]
                      .filter(Boolean)
                      .join("\n")}>
                  {name ? `${name} ${surname}` : `User #${userId}`}
                </TooltipWrapper>
              </th>
              {questions.map(({questionId, question}) => {
                const attempts = answers[questionId!];
                if (!attempts || attempts.length === 0) {
                  return <td key={userId + questionId} />;
                }
                const {isCorrect} = attempts[attempts.length - 1];
                return (
                  <td key={`${userId}-${questionId}`}>
                    <TooltipWrapper
                      tooltip={<>
                        <p>{question}</p>
                        <ul style={{listStyleType: "none"}}>
                          { attempts.map(({isCorrect, answer, createdAt}, i) =>
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
                          ) }
                        </ul>
                      </>}
                    >
                      { corrSym(isCorrect) }
                    </TooltipWrapper>
                  </td>
                );
              })}
              <th className="total">
                {questions
                  .map(({id}) => answers[id!])
                  .map((attempts) => attempts?.[attempts.length - 1].points || 0)
                  .reduce((a: number, b) => a + b, 0)}
              </th>
            </tr>
            ))}
          <tr>
            <th>N = {filteredResults.length}</th>
            {questions.map(({id, question}) =>
              <td key={`tot-${id}`}>
                <TooltipWrapper tooltip={question}>
                  { filteredResults
                      .map(({answers}) =>
                        answers[id!]?.[answers[id!].length - 1].isCorrect ? 1 : 0)
                      .reduce((a: number, b) => a + b, 0)
                  }
                </TooltipWrapper>
              </td>
            )}
            <th style={{textAlign: "center"}}>
              {questions.flatMap(({id}) =>
                filteredResults
                  .map(({answers}) => answers[id!]?.[answers[id!].length - 1].points || 0)
              ).reduce((a: number, b) => a + b, 0) / filteredResults.length
              }
            </th>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      <a href={`/quiz-results?bookId=${bookId}&accessToken=${user?.accessToken}${group ? `&groupId=${group}` : ""}`}>
        Download all answers as Excel
       </a>
    </p>
    </Layout>
    )
      ;
    }

export function CollectionResults({collectionId, frontmatter, books}: CollectionProps) {
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

  const [group, setGroup] = React.useState<number | null>(null);
  const filteredResults = React.useMemo(
    () => filterResults(results, group),
    [results, group]
  );

  const hasGroups = React.useMemo(() => groups?.length > 0, [groups]);

  if (results === false) {
    return <p>You do not have permission to view these results.</p>
  }

  if (!filteredResults || !groups) {
    return <p>Loading results...</p>
  }

  return (
    <Layout title={frontmatter.title} returnLink="Collection" >
      <div className="prose mx-auto admin-page">
        <div className="flex justify-between items-end">
          <h2>Results for Collection &apos;{frontmatter.title}&apos;</h2>
          { hasGroups &&
            <GroupsCombo groups={groups} value={group} onChange={setGroup}/>
          }
        </div>
        <table className="tableAuto w-auto quiz-results">
          <thead>
          <tr>
            <td/>
            {books.map(({title, slug}) => (
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
           : filteredResults.map(({userId, name, surname, points}) => (
              <tr key={userId}>
                <th>{name ? `${name} ${surname}` : `User #${userId}`}</th>
                {books.map(({id: bookId}) =>
                  <td key={`${userId}-${bookId}`}>
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
    </Layout>
  );
}
