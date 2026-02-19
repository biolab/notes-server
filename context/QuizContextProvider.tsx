import React from "react";

import {getQId, postAnswer, PostAnswerResult, CorrectAnswers, postFileAnswer} from "@/api/quiz";
import { ChapterDef } from "@/types";
import { logger } from "@/utils/logger";
import { UserContext } from "@/context/UserContextProvider";
import { useIntl } from "@/i18n";
import { getGroupId } from "@/api/book";
import { removeFiles as removeFilesFromServer} from "@/utils/zip";


export type Answer = {
  answer: string;
  isCorrect: boolean | undefined;
  points: number;
}

export type AnswerWithQuestionId = Answer & {
  questionId: string;
}

export interface QuestionI {
  questionId: string;
  maxPoints: number;
  chapterIndex: number;
  answers: Answer[];
  submissionErrored?: boolean | string;
  correctAnswer?: string;
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
      (chapter.questions || []).map(({questionId, maxPoints}) => [
        questionId,
        {
          questionId,
          maxPoints: maxPoints || 0,
          chapterIndex,
          answers: [],
        }
      ]
  )));

const getQuizState = ({
  quizThreshold,
  chapters = [],
  answers,
  correctAnswers
}: {
  chapters: ChapterDef[];
  quizThreshold: number;
  answers: AnswerWithQuestionId[] | null;
  correctAnswers: CorrectAnswers
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
  );
  correctAnswers.forEach(({questionId, answer}) => {
    state.questions[questionId].correctAnswer = answer;
  });
  logger("Quiz state initialized with answers:", state);
  return state;
};

type ActionType =
  { type: "ANSWER", value: AnswerWithQuestionId & { correctAnswer?: string; } } |
  { type: "REMOVEORADDFILES", value: {questionId: string, remove?: string[] | boolean, add?: string[]} } |
  { type: "ERROR",  value: {questionId: string, error?: string}
}

const reducer = (state: QuizStateI, action: ActionType): QuizStateI => {
  const { questionId, correctAnswer, ...data }
    = {correctAnswer: undefined, ...action.value};
  const prev = state.questions[questionId];

  switch (action.type) {
    case "ANSWER": {
      const questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          correctAnswer,
          submissionErrored: false,
          answers: [...prev?.answers ?? ([] as Answer[]), data as Answer]
        }
      }
      return {
        ...state,
        questions,
      }
    }
    case "REMOVEORADDFILES": {
      const {remove, add} = action.value;
      const prevAnswers = prev?.answers ?? ([] as Answer[]);
      const prevFiles = prevAnswers.length ? prevAnswers[prevAnswers.length - 1].answer.split(":") : [];
      const toRemove = ["", ...(remove === true || !remove ? [] : remove), ...(add ?? [])];
      const filteredFiles = remove === true ? [] : prevFiles.filter((n) => !toRemove.includes(n));
      const questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          answers: [...prevAnswers, {answer: [...filteredFiles, ...action.value.add ?? []].join(":"), points: 0}] as Answer[]
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
        [questionId]: {...prev, submissionErrored: action.value.error || true}
      }
      return {...state, questions}
    }
  }
}

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  nQuestions: number;
  achievedPoints: number;
  answered: number;
  correct: number;
  wrong: number;
  threshold: number | null;
  answerQuestion: (value: AnswerWithQuestionId) => Promise<boolean>;
  uploadFiles: (questionId: string, files: File[]) => Promise<boolean>;
  addFiles: (questionId: string, filed: File[]) => Promise<boolean>;
  removeFile: (questionId: string, fileName: string) => Promise<boolean>;
  getAnswers: (questionId: string) => Answer[];
  getLastAnswer: (questionId: string) => Answer | null;
  getCorrectAnswer: (questionId: string) => string | undefined;
  submissionErrored: (questionId: string) => boolean | string;
  chapterStats: (chapterIndex: number) => {
    nQuestions: number;
    answered: number;
    correct: number;
    achievedPoints: number,
    correctness: (boolean | null | undefined)[]
    questionIds: string[]
  }
}>({
  quizState: null,
  nQuestions: 0,
  achievedPoints: 0,
  answered: 0,
  correct: 0,
  wrong: 0,
  threshold: null,
  answerQuestion: async () => false,
  uploadFiles: async () => false,
  addFiles: async () => false,
  removeFile: async () => false,
  getAnswers: () => [],
  getLastAnswer: () => null,
  getCorrectAnswer: () => undefined,
  submissionErrored: () => false,
  chapterStats: () => ({ nQuestions: 0, answered: 0, correct: 0, wrong: 0,
                         achievedPoints: 0, correctness: [], questionIds: []})
});

export const QuizContextProvider = ({
  children,
  quizThreshold,
  chapters,
  answers,
  correctAnswers,
  bookId,
}: {
  children: React.ReactNode;
  quizThreshold: number;
  chapters: ChapterDef[];
  bookId: number;
  answers: AnswerWithQuestionId[] | null;
  correctAnswers: { questionId: string, answer: string}[]
}) => {
  const { user, userGroup } = React.useContext(UserContext);
  const { t } = useIntl();

  const [quizState, quizReducer]: [QuizStateI, React.Dispatch<ActionType>] =
    React.useReducer(
      reducer,
      getQuizState({ quizThreshold, answers, correctAnswers, chapters })
    );

  const checkUser = React.useCallback((questionId: string): boolean => {
    if (!user) {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: t("quiz.not-logged-in")}});
      return false;
    }
    return true;
  }, [user, quizReducer, t]);

  const answerQuestion = React.useCallback(
    async ({questionId, answer, isCorrect, points}: AnswerWithQuestionId
    ): Promise<boolean> => {
      if (!checkUser(questionId)) {
        return false;
      }
      let postResult: PostAnswerResult | undefined;
      try {
        postResult = await postAnswer({
          accessToken: user!.accessToken, group: userGroup, bookId,
          questionId, answer, isCorrect, points});
      } catch (error: any) {
        quizReducer({ type: "ERROR", value: {questionId}});
        return false;
      }
      if (postResult.status === "error") {
        quizReducer({
          type: "ERROR",
          value: {questionId, error: postResult.message}});
        return false;
      }
      quizReducer({
        type: "ANSWER",
        value: {
          questionId,
          answer,
          ...postResult as Extract<PostAnswerResult, { status: "ok" }>
        }
      });
      return true;
    },
    [user, checkUser, bookId, quizReducer, userGroup]
  );

  const getAnswers = React.useCallback(
    (questionId: string) => quizState.questions[questionId]?.answers ?? [],
    [quizState]);

  const getLastAnswer = React.useCallback(
    (questionId: string) => {
      const answers = getAnswers(questionId);
      return answers.length ? answers[answers.length - 1] : null;
    },
    [getAnswers]
  );

  const addRemoveFiles = React.useCallback(
    async(questionId: string, addFiles: File[], removeFiles: string[] | boolean = false): Promise<boolean> => {
      if (!checkUser(questionId)) {
        return false;
      }
      const totalSize = addFiles.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > 50 * 1024 * 1024) {
        quizReducer({
          type: "ERROR",
          value: {questionId, error: t("quiz.files-too-large")}});
        return false;
      }

      if (addFiles.some((file) => file.size > 9.9 * 1024 * 1024)) {
        quizReducer({
          type: "ERROR",
          value: {questionId, error: t("quiz.file-too-large")}});
        return false;
      }

      const groupId = userGroup ? await getGroupId(userGroup, bookId) : null;
      if (userGroup && groupId === null) {
        quizReducer({
          type: "ERROR",
          value: {questionId, error: t("quiz.invalid-group")}
        });
        return false;
      }

      if (removeFiles !== false) {
        const error = await removeFilesFromServer(
          removeFiles,
          {bookId, groupId, questionId, accessToken: user!.accessToken}
        );
        if (error) {
          quizReducer({
            type: "ERROR",
            value: {questionId, error: t("quiz.cant-remove-file")}
          });
          return false;
        }
      }

      for(const file of addFiles) {
        const formData = new FormData();
        formData.append("files", file);
        formData.append("accessToken", user?.accessToken || "");
        formData.append("bookId", bookId.toString());
        formData.append("qId",
          (await getQId(bookId, questionId)).toString());
        if (groupId) {
          formData.append("groupId", groupId.toString());
        }
        const res = await fetch("/api/upload-answer", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          quizReducer({type: "ERROR", value: {questionId}});
          return false;
        }
      }

      const fileNames = addFiles.map(({name}) => name);
      try {
        const postResult = await postFileAnswer({
          accessToken: user!.accessToken, group: userGroup, bookId,
          questionId, addFiles: fileNames, removeFiles});
        if (postResult) {
          quizReducer({ type: "ERROR", value: {questionId, error: postResult}});
        }
      } catch (error: any) {
        quizReducer({ type: "ERROR", value: {questionId}});
        return false;
      }

      quizReducer({
        type: "REMOVEORADDFILES",
        value: {
          questionId,
          add: fileNames,
          remove: removeFiles
        }
      });
      return true;
    },
    [user, userGroup, bookId, quizReducer, t, checkUser]);

  const addFiles = React.useCallback((questionId: string, files: File[]) => {
    return addRemoveFiles(questionId, files, false);
  }, [addRemoveFiles]);

  const removeFile = React.useCallback(async (questionId: string, fileName: string) => {
    return addRemoveFiles(questionId, [], [fileName]);
  }, [addRemoveFiles]);

  const {
    nQuestions,
    achievedPoints,
    answered,
    correct,
    wrong,
    chapterStats,
  } = React.useMemo(
    () => ({
      nQuestions: Object.values(quizState.questions).length,

      chapterStats: (chapterIndex: number) => {
        const questionsInChapter = Object.values(quizState.questions)
          .filter((q) => q.chapterIndex === chapterIndex);
        const answered = questionsInChapter
          .filter((q) => q.answers.length > 0).length;
        const correct = questionsInChapter
          .filter((q) =>
            q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect === true).length;
        const wrong = questionsInChapter
          .filter((q) =>
            q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect === false).length;
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
          nQuestions: questionsInChapter.length,
          answered,
          correct,
          wrong,
          achievedPoints,
          correctness,
          questionIds
        }
      },

      correct: Object.values(quizState.questions)
        .filter((q) =>
            q.maxPoints
            && q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect === true)
        .length,

      wrong: Object.values(quizState.questions)
        .filter((q) =>
            q.maxPoints
            && q.answers.length > 0
            && q.answers[q.answers.length - 1].isCorrect === false)
        .length,

      answered: Object.values(quizState.questions)
        .filter((q) => q.answers.length)
        .length,

      achievedPoints: Object.values(quizState.questions).reduce(
        (acc, {answers}) =>
          acc + (answers.length && answers[answers.length - 1].points),
        0)
    }),
    [quizState]
  );

  const contextValue = React.useMemo(
    () => ({
      quizState,
      nQuestions,
      achievedPoints,
      answered,
      correct,
      wrong,
      threshold: quizThreshold,
      answerQuestion,
      uploadFiles: addRemoveFiles,
      addFiles,
      removeFile,
      chapterStats,
      getCorrectAnswer: (questionId: string) => quizState.questions[questionId]?.correctAnswer,
      getAnswers,
      getLastAnswer,
      submissionErrored: (questionId: string) => quizState.questions[questionId]?.submissionErrored || false
    }),
    [
      quizState,
      answerQuestion,
      addRemoveFiles,
      addFiles,
      removeFile,
      nQuestions,
      quizThreshold,
      achievedPoints,
      answered,
      correct,
      wrong,
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
    answerQuestion: aq,
    uploadFiles: uf,
    getCorrectAnswer,
  } = React.useContext(QuizContext);
  const answers = getAnswers(questionId) || [];
  const value = {
    attempts: answers.length,
    submissionErrored: submissionErrored(questionId),
    answerQuestion: async (value: Answer) => await aq({questionId, ...value}),
    uploadFiles: async (files: File[]) => await uf(questionId, files),
    correctAnswer: getCorrectAnswer(questionId)
  };
  if (answers.length === 0) {
    return {
      ...value,
      isCorrect: null,
      answer: null,
      correctAnswer: null,
      attempts: 0,
      points: null}
  }
  return {...value, ...answers[answers.length - 1] }
}

export const useFileAnswer = (questionId: string) => {
  const { getLastAnswer, submissionErrored, addFiles, removeFile } = React.useContext(QuizContext);
  const fileNames = getLastAnswer(questionId)?.answer;
  const files = fileNames ? fileNames.split(":") : [];
  return {
    files,
    submissionErrored: submissionErrored(questionId),
    addFiles: async (files: File[]) => await addFiles(questionId, files),
    removeFile: async (fileName: string) => await removeFile(questionId, fileName)
  }
}
