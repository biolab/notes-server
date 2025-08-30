'use client';

import { AnswerRecord, getAnswersInBooks, getQuestionsInBooks, QuestionRecord } from "@/api/QuizService";
import React from "react";

export function Results({bookIds}: {bookIds: number[]}) {
  const [questions, setQuestions] = React.useState<QuestionRecord[] | null>(null);
  React.useEffect(() => {
    getQuestionsInBooks(bookIds).then(setQuestions)
  },
  [bookIds]);

  const [answers, setAnswers] = React.useState<{[userId: string]: {[questionId: string]: AnswerRecord[]}} | null>(null);
  React.useEffect(() => {
    getAnswersInBooks(bookIds)
      .then((res) => {
        const resultTable = Object.fromEntries(
          res.map(({userId, questionId}) => [userId, {[questionId]: [] as AnswerRecord[]}]));
        res.forEach((answer: AnswerRecord) => {
          resultTable[answer.userId][answer.questionId].push(answer);
        });
        setAnswers(resultTable);
      })
  }, [bookIds]);
  return (
    <div className="prose mx-auto admin-page">
      <h2>Results</h2>
      {questions && answers ? (
        <table className="tableAuto quiz-table">
          <thead>
          <tr>
            <td/>
            {questions.map(({question, questionId}, i) => (
              <th key={questionId} title={question}>
                Q{i + 1}
              </th>
            ))}
          </tr>
          </thead>
          <tbody>
          {Object.entries(answers).map(([userId, answers]) => (
            <tr key={userId}>
              <th>{userId}</th>
              {questions.map(({questionId}) => {
                const attempts = answers?.[questionId];
                if (!attempts || attempts.length === 0) {
                  return <td key={42} />
                }
                const {isCorrect } = attempts[attempts.length - 1];
                return (
                  <td key={questionId}>
                    {isCorrect === undefined ? "⨀" : isCorrect ? "✓" : "✕"}

                  </td>
                );
              })}
            </tr>
          ))}
          </tbody>
        </table>
        /*Object.entries(results).map(([userId, answers]) => (
          <div key={userId}>
            <h3>User {userId}</h3>
            {Object.entries(answers).map(([questionId, answerRecords]) => (
              <div key={questionId}>
                <h4>Question {questionId}</h4>
                <ul>
                  {answerRecords.map((record, index) => (
                    <li key={index}>
                      Answer: {record.answer}, Correct: {record.isCorrect ? "Yes" : "No"}, Points: {record.points}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))*/
      ) : (
         <p>Loading results...</p>
       )}
    </div>
  );
}