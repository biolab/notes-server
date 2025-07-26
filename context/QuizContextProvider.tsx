import { ChapterDef } from "@/types/types";
import React from "react";
import { logger } from "@/utils/logger";
import { postAnswer } from "@/api/QuizService";
import { toast } from "react-toastify";
import { UserContext } from "@/context/UserContextProvider";

export type IAnswerValue = {
  isCorrect: boolean | undefined;
  answer: string | string[];
  points: number;
};

export type IAnswerValueWithQuestionId = IAnswerValue & {
  questionId: string
}

export interface QuestionI {
  questionId: string;
  maxPoints: number;
  chapterIndex: number;
  answers: IAnswerValue[];
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
  answers?: IAnswerValueWithQuestionId[] | null;
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
    state.questions[questionId].answers.push(answerWOutId as IAnswerValue);
    }
  )
  logger("Quiz state initialized with answers:", state);
  return state;
};

const reducer = (
  state: QuizStateI,
  action: {
    type: string;
    value: IAnswerValueWithQuestionId
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
  answerQuestion: (value: IAnswerValueWithQuestionId) => void;
  noOfQuestions: number;
  availablePoints: number;
  achievedPoints: number;
  correctlyAnsweredQuestions: number;
  answeredMandatoryQuestions: number;
  isQuizComplete: boolean;
  allCompletedChapters: number[];
  chaptersWithMandatoryQuestions: number[];
  getAnswers: (questionId: string) => IAnswerValue[]
}>({
  quizState: null,
  answerQuestion: () => {},
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
  answers: IAnswerValueWithQuestionId[] | null;
}) => {
    const { user } = React.useContext(UserContext);

  const [quizState, quizReducer]: [
    QuizStateI,
    React.Dispatch<{ type: string; value: IAnswerValueWithQuestionId }>
  ] = React.useReducer(
    reducer,
    getQuizState({ quizThreshold, answers, chapters })
  );


  const answerQuestion = React.useCallback(
    async (value: IAnswerValueWithQuestionId) => {
      try {
        await postAnswer({
          questionId: value.questionId,
          user,
          bookId,
          answer:
            typeof value.answer === "string"
            ? value.answer
            : value.answer.join("|||"),
          points: value.points,
          correct: value.isCorrect,
        });
        quizReducer({ type: "ANSWER", value });
      } catch (error: any) {
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
    <QuizContext.Provider value={contextValue}>{children}</QuizContext.Provider>
  );
};
