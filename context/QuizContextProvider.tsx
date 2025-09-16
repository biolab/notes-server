import React from "react";

import { postAnswer } from "@/api/quiz";
import { ChapterDef } from "@/types";
import { logger } from "@/utils/logger";
import { UserContext } from "@/context/UserContextProvider";


export type Answer = {
  answer: string;
  isCorrect: boolean | undefined;
  points: number;
};

export type AnswerWithQuestionId = Answer & {
  questionId: string
}

export interface QuestionI {
  questionId: string;
  maxPoints: number;
  chapterIndex: number;
  answers: Answer[];
  submissionErrored?: boolean;
}

type Questions = {[questionID: string]: QuestionI};

export interface QuizStateI {
  questions: Questions;
  chaptersWithQuiz: number[];
  quizThreshold: number;
}

const getQuestionsFromChapters = (chapters: ChapterDef[]): Questions =>
  Object.fromEntries(
    chapters.flatMap((chapter, chapterIndex) =>
      (chapter.questions || []).map(({questionId, points}) => [
        questionId,
        {
          questionId,
          maxPoints: points || 0,
          chapterIndex,
          answers: [],
        }
      ]
  )));

const getQuizState = ({
  quizThreshold,
  chapters = [],
  answers,
}: {
  chapters: ChapterDef[];
  quizThreshold: number;
  answers?: AnswerWithQuestionId[] | null;
}) => {
  const state: QuizStateI = {
    questions: getQuestionsFromChapters(chapters),
    chaptersWithQuiz: chapters
      .map((chapter, index) => (chapter.questions?.length ? index : -1))
      .filter((index) => index !== -1),
    quizThreshold,
  };
  (answers || []).forEach((answer) => {
    const {questionId, ...answerWOutId} = answer;
    state.questions[questionId].answers.push(answerWOutId as Answer);
    }
  )
  logger("Quiz state initialized with answers:", state);
  return state;
};

type ActionType =
  { type: "ANSWER", value: AnswerWithQuestionId } |
  { type: "ERROR",  value: {questionId: string}
}

const reducer = (state: QuizStateI, action: ActionType): QuizStateI => {
  const { questionId, ...data } = action.value;
  const prev = state.questions[questionId];
  switch (action.type) {
    case "ANSWER": {
      const questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          answers: [...prev?.answers ?? ([] as Answer[]), data as Answer]
        }
      }
      return {
        ...state,
        questions,
      }
    }
    case "ERROR": {
      const questions = {
        ...state.questions,
        [questionId]: {...prev, submissionErrored: true}
      }
      return {...state, questions}
    }
  }
}

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  noOfQuestions: number;
  achievedPoints: number;
  correctAnswers: number;
  answeredQuestions: number;
  answerQuestion: (value: AnswerWithQuestionId) => Promise<boolean>;
  getAnswers: (questionId: string) => Answer[];
  submissionErrored: (questionId: string) => boolean;
  chapterStats: (chapterIndex: number) => {
    noOfQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    achievedPoints: number,
    correctness: (boolean | null | undefined)[]
    questionIds: string[]
  }
}>({
  quizState: null,
  noOfQuestions: 0,
  achievedPoints: 0,
  correctAnswers: 0,
  answeredQuestions: 0,
  answerQuestion: async () => false,
  getAnswers: () => [],
  submissionErrored: () => false,
  chapterStats: () => ({ noOfQuestions: 0, answeredQuestions: 0, correctAnswers: 0, achievedPoints: 0,
                         correctness: [], questionIds: []})
});

export const QuizContextProvider = ({
  children,
  quizThreshold,
  chapters,
  answers,
  bookId,
}: {
  children: React.ReactNode;
  quizThreshold: number;
  chapters: ChapterDef[];
  bookId: number;
  answers: AnswerWithQuestionId[] | null;
}) => {
  const { user, userGroup } = React.useContext(UserContext);

  const [quizState, quizReducer]: [QuizStateI, React.Dispatch<ActionType>] =
    React.useReducer(
      reducer,
      getQuizState({ quizThreshold, answers, chapters })
    );

  const answerQuestion = React.useCallback(
    async (value: AnswerWithQuestionId): Promise<boolean> => {
      const {questionId, answer, points, isCorrect} = value;
      if (!user) {
        quizReducer({type: "ERROR", value: {questionId}});
        return false;
      }
      try {
        await postAnswer({
          accessToken: user.accessToken, group: userGroup,
          questionId, bookId, answer, isCorrect, points});
      } catch (error: any) {
        quizReducer({ type: "ERROR", value: {questionId}});
        return false;
      }
      quizReducer({ type: "ANSWER", value });
      return true;
    },
    [user, bookId, quizReducer, userGroup]
  );

  const {
    noOfQuestions,
    achievedPoints,
    correctAnswers,
    answeredQuestions,
    chapterStats,
  } = React.useMemo(
    () => ({
      noOfQuestions: Object.values(quizState.questions).length,

      chapterStats: (chapterIndex: number) => {
        const questionsInChapter = Object.values(quizState.questions)
          .filter((q) => q.chapterIndex === chapterIndex);
        const answeredQuestions = questionsInChapter
          .filter((q) => q.answers.length > 0).length;
        const correctAnswers = questionsInChapter
          .filter((q) =>
            q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect !== false).length;
        const achievedPoints = questionsInChapter.reduce(
          (acc, {answers}) =>
            acc + (answers.length && answers[answers.length - 1].points),
          0);
        const correctness = questionsInChapter.map((q) =>
          q.answers.length === 0
            ? null
            : q.answers[q.answers.length - 1].isCorrect);
        const questionIds = questionsInChapter.map((q) => q.questionId);
        return {
          noOfQuestions: questionsInChapter.length,
          answeredQuestions,
          correctAnswers,
          achievedPoints,
          correctness,
          questionIds
        }
      },

      correctAnswers: Object.values(quizState.questions)
        .filter((q) =>
            !q.maxPoints
            && q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect !== false)
        .length,

      answeredQuestions: Object.values(quizState.questions)
        .filter((q) => q.answers.length)
        .length,

      achievedPoints: Object.values(quizState.questions).reduce(
        (acc, {answers}) =>
          acc + (answers.length && answers[answers.length - 1].points),
        0),
    }),
    [quizState]
  );

  const contextValue = React.useMemo(
    () => ({
      quizState,
      noOfQuestions,
      achievedPoints,
      correctAnswers,
      answeredQuestions,
      answerQuestion,
      chapterStats,
      getAnswers: (questionId: string) => quizState.questions[questionId]?.answers ?? [],
      submissionErrored: (questionId: string) => !!quizState.questions[questionId]?.submissionErrored
    }),
    [
      quizState,
      answerQuestion,
      noOfQuestions,
      achievedPoints,
      correctAnswers,
      answeredQuestions,
      chapterStats
    ]
  );

  return (
    <QuizContext.Provider value={contextValue}>
      {children}
    </QuizContext.Provider>
  );
};

export const useLastAnswer = (questionId: string) => {
  const {
    getAnswers,
    submissionErrored,
    answerQuestion: aq
  } = React.useContext(QuizContext);
  const answers = getAnswers(questionId) || [];
  const value = {
    trials: answers.length,
    submissionErrored: submissionErrored(questionId),
    answerQuestion: async (value: Answer) => await aq({questionId, ...value})
  };
  if (answers.length === 0) {
    return {
      ...value,
      isCorrect: null,
      answer: null,
      trials: 0,
      points: null}
  }
  return {...value, ...answers[answers.length - 1] }
}