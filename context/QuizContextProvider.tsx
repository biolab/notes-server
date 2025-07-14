import { ChapterDef } from "@/types/types";
import React, { useReducer } from "react";
import { logger } from "@/utils/logger";

// Bump quiz version if interface changes
export const QUIZ_VERSION = 2;

export type IAnswerValue = {
  questionId: string;
  isCorrect: boolean | null;
  isNeutral: boolean;
  answer: string | string[];
  points: number;
  trial: number;
};

export interface QuestionI {
  questionId: string;
  question: string;
  possiblePoints: number;
  chapterIndex: number;
  max_trials?: number;
  answers: IAnswerValue[];
  optional: boolean;
}

export interface QuizStateI {
  book_title: string;
  slug: string;
  questions: QuestionI[];
  chaptersWithQuiz: number[];
  quizThreshold: number;
  isQuizComplete: boolean;
}

const getQuestionsFromChapters = (chapters: ChapterDef[]): QuestionI[] => {
  return chapters.flatMap((chapter, chapterIndex) => {
    return (chapter.questions || []).map((question) => ({
      questionId: question.questionId,
      question: question.question,
      possiblePoints: question.points || 0,
      chapterIndex,
      answers: [],
      optional: question.optional || false,
    }));
  });
};

const getQuizState = ({
  title,
  slug,
  quizThreshold,
  chapters = [],
  answers,
}: {
  title: string;
  slug: string;
  chapters: ChapterDef[];
  quizThreshold: number;
  answers?: IAnswerValue[] | null;
}) => {
  const state: QuizStateI = {
    book_title: title,
    slug,
    questions: getQuestionsFromChapters(chapters),
    chaptersWithQuiz: chapters
      .map((chapter, index) => (chapter.questions?.length ? index : -1))
      .filter((index) => index !== -1),
    quizThreshold,
    isQuizComplete: false,
  };

  if (!answers) {
    return state;
  }

  for (const answer of answers) {
    const question = state.questions.find(
      (q) => q.questionId === answer.questionId
    );

    if (question) {
      question.answers.push(answer);
    }
  }

  logger("Quiz state initialized with answers:", state);

  return state;
};

const reducer = (
  state: QuizStateI,
  action: {
    type: string;
    value: IAnswerValue;
  }
) => {
  const { type, value } = action;

  switch (type) {
    case "ANSWER_QUIZ":
      const _state = {
        ...state,
        questions: state.questions.map((q) =>
          q.questionId === value.questionId
            ? {
                ...q,
                answers: [...(q.answers || []), value],
              }
            : q
        ),
      };

      const isComplete = _state.questions
        .filter((q) => !q.optional)
        .every((q) => q.answers.length > 0);

      return {
        ..._state,
        isQuizComplete: isComplete,
      };

    default:
      return state;
  }
};

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  quizReducer: React.Dispatch<{ type: string; value: IAnswerValue }>;
  submitQuiz: () => void;
  noOfQuestions: number;
  availablePoints: number;
  achievedPoints: number;
  correctlyAnsweredQuestions: number;
  answeredMandatoryQuestions: number;
  isQuizComplete: boolean;
  allCompletedChapters: number[];
  chaptersWithMandatoryQuestions: number[];
}>({
  quizState: null,
  quizReducer: () => null,
  submitQuiz: () => null,
  noOfQuestions: 0,
  availablePoints: 0,
  achievedPoints: 0,
  correctlyAnsweredQuestions: 0,
  answeredMandatoryQuestions: 0,
  isQuizComplete: false,
  allCompletedChapters: [],
  chaptersWithMandatoryQuestions: [],
});

export const QuizContextProvider = ({
  children,
  title,
  quizThreshold,
  slug,
  chapters,
  answers,
}: {
  children: React.ReactNode;
  title: string;
  quizThreshold: number;
  slug: string;
  chapters: ChapterDef[];
  answers: IAnswerValue[] | null; // Optional initial quiz state
}) => {
  const [quizState, quizReducer]: [
    QuizStateI,
    React.Dispatch<{ type: string; value: IAnswerValue }>
  ] = useReducer(
    reducer,
    getQuizState({ title, slug, quizThreshold, answers, chapters })
  );

  const {
    noOfQuestions,
    availablePoints,
    achievedPoints,
    correctlyAnsweredQuestions,
    answeredMandatoryQuestions,
    allCompletedChapters,
    chaptersWithMandatoryQuestions,
  } = React.useMemo(
    () => ({
      chaptersWithMandatoryQuestions: quizState.chaptersWithQuiz.filter(
        (chapterIndex) =>
          quizState.questions
            .filter((q) => q.chapterIndex === chapterIndex)
            .some((q) => !q.optional)
      ),

      allCompletedChapters: quizState.chaptersWithQuiz.filter((chapterIndex) =>
        quizState.questions
          .filter((q) => q.chapterIndex === chapterIndex)
          .filter((q) => !q.optional)
          .every((q) => q.answers?.length > 0)
      ),

      noOfQuestions: quizState.questions.filter((q) => !q.optional).length,

      availablePoints: quizState.questions.reduce(
        (acc, q) => acc + q.possiblePoints,
        0
      ),

      correctlyAnsweredQuestions: quizState.questions
        .filter((q) => !q.optional)
        .reduce((acc, q) => {
          if ((q.answers || []).some((a) => a.isCorrect)) {
            return acc + 1;
          }

          return acc;
        }, 0),

      answeredMandatoryQuestions: quizState.questions
        .filter((q) => !q.optional)
        .reduce((acc, q) => {
          if (q.answers?.length) {
            return acc + 1;
          }

          return acc;
        }, 0),

      achievedPoints: quizState.questions.reduce((acc, q) => {
        if ((q.answers || []).some((a) => a.isCorrect)) {
          return acc + q.possiblePoints;
        }

        return acc;
      }, 0),
    }),
    [quizState]
  );

  const isQuizComplete = React.useMemo(
    () => noOfQuestions > 0 && answeredMandatoryQuestions === noOfQuestions,
    [answeredMandatoryQuestions, noOfQuestions]
  );

  const contextValue = React.useMemo(
    () => ({
      quizState,
      quizReducer,
      noOfQuestions,
      availablePoints,
      achievedPoints,
      correctlyAnsweredQuestions,
      answeredMandatoryQuestions,
      isQuizComplete,
      allCompletedChapters,
      chaptersWithMandatoryQuestions,
    }),
    [
      quizState,
      quizReducer,
      noOfQuestions,
      availablePoints,
      achievedPoints,
      correctlyAnsweredQuestions,
      answeredMandatoryQuestions,
      isQuizComplete,
      allCompletedChapters,
      chaptersWithMandatoryQuestions,
    ]
  );

  return (
    <QuizContext.Provider value={contextValue}>{children}</QuizContext.Provider>
  );
};
