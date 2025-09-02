'use client';

import {
  AnswersInBook,
  PointsInCollection,
  getAnswersInBook,
  getCollectionResults,
  UserDesc,
} from "@/api/QuizService";
import React from "react";
import {
  BookProps,
  CollectionProps,
  getBookGroups,
  getCollectionGroups,
  GroupList
} from "@/api/BookService";
import { UserContext } from "@/context/UserContextProvider";
import Layout from "@/components/Layout/Layout";

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

function filterResults<T extends UserDesc>(results: T[] | false | null, group: number | null): T[] | false | null
{
  return group && results
         ? results.filter(({groupId}) => groupId === group)
         : results;
}
/*
function AnswerBreakdown({results, question, questionId}: {
    results: AnswersInBook,
    questionId: string,
    question: string}) {
  return
    <table className="tableAuto w-auto quiz-results">
      <thead>
      <tr>

    }*/
export function BookResults({bookId, frontmatter, chapters}: BookProps) {
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

  const corrSym = (isCorrect: boolean | undefined) =>
    isCorrect === undefined ? "⨀"
    : isCorrect ? "✓"
    : "✕";

  const corrColor = (isCorrect: boolean | undefined) =>
    isCorrect === undefined ? "white"
    : isCorrect ? "lawngreen"
    : "pink";

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
            {questions.map(({id, question}) => (
              <th key={id} className="rotated">
                <div className="relative group inline-block">
                  <div className="rotated">
                    {question}
                  </div>
                  <div className="rtooltip absolute bottom-0 left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block
                bg-black text-white text-xs rounded px-2 py-1 z-50">
                    {question}
                  </div>
                </div>
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
              <th
                title={
                  [email, hasGroups && `Group: ${groups.find((g) => g.id === groupId)?.name}`]
                    .filter(Boolean)
                    .join("\n")}
              >
                {name ? `${name} ${surname}` : `User #${userId}`}
              </th>
              {questions.map(({id, questionId, question}) => {
                const attempts = answers[id!];
                if (!attempts || attempts.length === 0) {
                  return <td key={userId + questionId} />;
                }
                const {isCorrect} = attempts[attempts.length - 1];
                return (
                  <td key={`${userId}-${questionId}`}>
                    <div className="relative group inline-block">
                      <div>
                        {corrSym(isCorrect)}
                      </div>
                      <div className="tooltip">
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
                      </div>
                    </div>
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
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export function CollectionResults({collectionId, frontmatter, books}: CollectionProps) {
  const [results, setResults] = React.useState<PointsInCollection | false | null>(null);
  const { user } = React.useContext(UserContext);
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
                <div className="relative group inline-block">
                  <div className="rotated">
                    {title}
                  </div>
                  <div className="rtooltip absolute bottom-0 left-1/2 -translate-x-1/2 hidden group-hover:block
                bg-black text-white text-xs rounded px-2 py-1 z-50">
                    {title}
                  </div>
                </div>
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