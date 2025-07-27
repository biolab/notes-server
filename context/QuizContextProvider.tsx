import { ChapterDef } from "@/types/types";
import React from "react";
import { logger } from "@/utils/logger";
import { postAnswer } from "@/api/QuizService";
import { toast } from "react-toastify";
import { UserContext } from "@/context/UserContextProvider";

export type Answer = {
  answer: string | string[];
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
  optional: boolean;
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
      (chapter.questions || []).map(({questionId, points, optional}) => [
        questionId,
        {
          questionId,
          maxPoints: points || 0,
          chapterIndex,
          answers: [],
          optional: optional || false,
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

const reducer = (
  state: QuizStateI,
  action: {
    type: string;
    value: AnswerWithQuestionId
  }
) => {
  const { questionId, ...data } = action.value
  const prev = state.questions[questionId];

  switch (action.type) {
    case "ANSWER":
      const questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          answers: [...prev?.answers ?? [], data]
        }
      }
      const isComplete = Object.values(questions).every(
        (q) => q.optional || q.answers.length > 0);

      return {
        ...state,
        questions,
        isQuizComplete: isComplete,
      }

    default:
      return state;
  }
}

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  answerQuestion: (value: AnswerWithQuestionId) => Promise<void>;
  noOfQuestions: number;
  availablePoints: number;
  achievedPoints: number;
  correctlyAnsweredQuestions: number;
  answeredMandatoryQuestions: number;
  isQuizComplete: boolean;
  allCompletedChapters: number[];
  chaptersWithMandatoryQuestions: number[];
  getAnswers: (questionId: string) => Answer[]
}>({
  quizState: null,
  answerQuestion: async () => {},
  noOfQuestions: 0,
  availablePoints: 0,
  achievedPoints: 0,
  correctlyAnsweredQuestions: 0,
  answeredMandatoryQuestions: 0,
  isQuizComplete: false,
  allCompletedChapters: [],
  chaptersWithMandatoryQuestions: [],
  getAnswers: () => []
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
    const { user } = React.useContext(UserContext);

  const [quizState, quizReducer]: [
    QuizStateI,
    React.Dispatch<{ type: string; value: AnswerWithQuestionId }>
  ] = React.useReducer(
    reducer,
    getQuizState({ quizThreshold, answers, chapters })
  );

  const answerQuestion = React.useCallback(
    async (value: AnswerWithQuestionId) => {
      const {questionId, answer, points, isCorrect} = value;
      try {
        await postAnswer({
          questionId, user, bookId, points, isCorrect,
          answer: typeof answer === "string" ? answer : answer.join("|||"),
        });
        quizReducer({ type: "ANSWER", value });
      } catch (error: any) {
        // todo: add error state to question and report it there (via useLastAnswer)
        toast.error(
          `Something went wrong. Answers are not saved.${
            error.message ? ` Error: ${error.message}` : ""
          }`
        );
      }
    },
    [user, bookId, quizReducer]
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
          Object.values(quizState.questions)
            .filter((q) => q.chapterIndex === chapterIndex)
            .some((q) => !q.optional)
      ),

      allCompletedChapters: quizState.chaptersWithQuiz.filter((chapterIndex) =>
        Object.values(quizState.questions).every((q) =>
          q.chapterIndex !== chapterIndex
          || q.optional
          || q.answers.length > 0)),

      noOfQuestions: Object.values(quizState.questions)
        .filter((q) => !q.optional)
        .length,

      availablePoints: Object.values(quizState.questions)
        .reduce((acc, q) => acc + q.maxPoints, 0),

      correctlyAnsweredQuestions: Object.values(quizState.questions)
        .filter((q) =>
            !q.optional
            && q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect)
        .length,

      answeredMandatoryQuestions: Object.values(quizState.questions)
        .filter((q) => !q.optional && q.answers.length)
        .length,

      achievedPoints: Object.values(quizState.questions).reduce(
        (acc, {answers}) =>
          acc + (answers.length && answers[answers.length - 1].points),
        0),
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
      answerQuestion,
      noOfQuestions,
      availablePoints,
      achievedPoints,
      correctlyAnsweredQuestions,
      answeredMandatoryQuestions,
      isQuizComplete,
      allCompletedChapters,
      chaptersWithMandatoryQuestions,
      getAnswers: (questionId: string) => quizState.questions[questionId]?.answers ?? []
    }),
    [
      quizState,
      answerQuestion,
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
    <QuizContext.Provider value={contextValue}>
      {children}
    </QuizContext.Provider>
  );
};

export const useLastAnswer = (questionId: string) => {
  const { getAnswers, answerQuestion: aq } = React.useContext(QuizContext);
  const answerQuestion =
    async (value: Answer) => await aq({questionId, ...value});
  const answers = getAnswers(questionId);
  if (!answers || answers.length === 0) {
    return {
      isCorrect: null,
      answer: null,
      trials: 0,
      points: null,
      answerQuestion
    }
  }
  return {
    ...answers[answers.length - 1],
    trials: answers.length,
    answerQuestion
  };
}