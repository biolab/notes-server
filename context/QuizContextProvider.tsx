import { ChapterDef } from "@/types/types";
import React from "react";
import { logger } from "@/utils/logger";
import { postAnswer } from "@/api/QuizService";
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
  isQuizComplete: boolean;
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
    isQuizComplete: false,
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
      const isComplete = Object.values(questions).every(
        (q) => !q.maxPoints || q.answers.length > 0);
      return {
        ...state,
        questions,
        isQuizComplete: isComplete,
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
  correctlyAnsweredQuestions: number;
  answeredQuestions: number;
  isQuizComplete: boolean;
  allCompletedChapters: number[];
  answerQuestion: (value: AnswerWithQuestionId) => Promise<boolean>;
  getAnswers: (questionId: string) => Answer[];
  submissionErrored: (questionId: string) => boolean;
  chapterStats: (chapterIndex: number) => { noOfQuestions: number; answeredQuestions: number; correctlyAnsweredQuestions: number; achievedPoints: number}}>({
  quizState: null,
  noOfQuestions: 0,
  achievedPoints: 0,
  correctlyAnsweredQuestions: 0,
  answeredQuestions: 0,
  isQuizComplete: false,
  allCompletedChapters: [],
  answerQuestion: async () => false,
  getAnswers: () => [],
  submissionErrored: () => false,
  chapterStats: () => ({ noOfQuestions: 0, answeredQuestions: 0, correctlyAnsweredQuestions: 0, achievedPoints: 0})
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
    [user, bookId, quizReducer]
  );

  const {
    noOfQuestions,
    achievedPoints,
    correctlyAnsweredQuestions,
    answeredQuestions,
    allCompletedChapters,
    chapterStats,
  } = React.useMemo(
    () => ({
      allCompletedChapters: quizState.chaptersWithQuiz.filter((chapterIndex) =>
        Object.values(quizState.questions).every((q) =>
          q.chapterIndex !== chapterIndex
          || q.maxPoints
          || q.answers.length > 0)),

      noOfQuestions: Object.values(quizState.questions).length,

      chapterStats: (chapterIndex: number) => {
        const questionsInChapter = Object.values(quizState.questions)
          .filter((q) => q.chapterIndex === chapterIndex);
        const answeredInChapter = questionsInChapter
          .filter((q) => q.answers.length > 0).length;
        const correctInChapter = questionsInChapter
          .filter((q) =>
            q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect !== false).length;
        const pointsInChapter = questionsInChapter.reduce(
          (acc, {answers}) =>
            acc + (answers.length && answers[answers.length - 1].points),
          0);
        return {
          noOfQuestions: questionsInChapter.length,
          answeredQuestions: answeredInChapter,
          correctlyAnsweredQuestions: correctInChapter,
          achievedPoints: pointsInChapter,
        }
      },

      correctlyAnsweredQuestions: Object.values(quizState.questions)
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

  const isQuizComplete = React.useMemo(
    () => noOfQuestions > 0 && answeredQuestions === noOfQuestions,
    [answeredQuestions, noOfQuestions]
  );

  const contextValue = React.useMemo(
    () => ({
      quizState,
      noOfQuestions,
      achievedPoints,
      correctlyAnsweredQuestions,
      answeredQuestions,
      isQuizComplete,
      allCompletedChapters,
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
      correctlyAnsweredQuestions,
      answeredQuestions,
      isQuizComplete,
      allCompletedChapters,
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