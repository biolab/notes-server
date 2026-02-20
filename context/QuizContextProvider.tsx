import React from "react";

import {getQId, postAnswer, PostAnswerResult, CorrectAnswers, postFileAnswer} from "@/api/quiz";
import { ChapterDef } from "@/types";
import { logger } from "@/utils/logger";
import { UserContext } from "@/context/UserContextProvider";
import { useIntl } from "@/i18n";
import { getGroupId } from "@/api/book";
import { removeFile as removeFileFromServer} from "@/utils/zip";
import path from "path";


export type AnswerValueData = {
  answer: string;
  isCorrect: boolean | undefined;
  points: number;
}

export type AnswerValue = { type: "value" } & AnswerValueData;

export type AnswerFileData = {
  files: string[];
  isCorrect?: never;
  points?: never;
}

export type AnswerFile = { type: "files" } & AnswerFileData;

export type Answer = (AnswerValue | AnswerFile);

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

type AnswerActionValue = Omit<AnswerValue, "type"> & { questionId: string, correctAnswer?: string; }
type ActionType =
  { type: "ANSWER", value: AnswerActionValue } |
  { type: "ADDFILE", value: {questionId: string, file: string} } |
  { type: "REMOVEFILE", value: {questionId: string, file: string} } |
  { type: "REMOVEFILES", value: {questionId: string } } |
  { type: "ERROR",  value: {questionId: string, error?: string}
}

const reducer = (state: QuizStateI, action: ActionType): QuizStateI => {
  const questionId = action.value.questionId;
  const prev = state.questions[questionId];

  let questions: Questions;
  switch (action.type) {
    case "ANSWER": {
      const {correctAnswer, ...data} = action.value;
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          correctAnswer,
          submissionErrored: false,
          answers: [...(prev?.answers ?? []) as AnswerValue[], {type: "value", ...data}]
        }
      }
      break;
    }

    case "REMOVEFILE": {
      if (!prev || !prev.answers.length) {
        return state;
      }
      const prevFiles = (prev.answers[prev.answers.length - 1] as AnswerFile).files;
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          answers: [
            ...prev.answers as AnswerFile[],
            { type: "files",
              files: prevFiles.filter((n) => n !== action.value.file),
            } as AnswerFile
          ]
        }
      }
      break;
    }

    case "REMOVEFILES": {
      if (!prev || !prev.answers.length) {
        return state;
      }
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          answers: [
            ...prev.answers as AnswerFile[],
            { type: "files", files: [] } as AnswerFile
          ]
        }
      }
      break;
    }

    case "ADDFILE": {
      const prevAnswers = prev?.answers ?? ([] as Answer[]);
      const prevFiles = prevAnswers.length ? (prevAnswers[prevAnswers.length - 1] as AnswerFile).files : [] as string[];
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          answers: [
            ...prevAnswers,
            {type: "files", files: [...prevFiles.filter((f) => f !== action.value.file), action.value.file]}
          ]
        }
      }
      break;
    }

    case "ERROR": {
      questions = {
        ...state.questions,
        [questionId]: {...prev, submissionErrored: action.value.error || true}
      }
    }
    break;
  }
  return {...state, questions}
}

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  nQuestions: number;
  achievedPoints: number;
  answered: number;
  correct: number;
  wrong: number;
  threshold: number | null;
  answerQuestion: ({questionId, answer, isCorrect, points}: AnswerValueData & { questionId: string }) => Promise<boolean>;
  addFiles: (questionId: string, files: File[]) => Promise<boolean>;
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

  const answerQuestion = React.useCallback(async (
    {questionId, answer, isCorrect, points}: AnswerValueData & { questionId: string }
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

  const addFiles = React.useCallback(async (questionId: string, files: File[]) => {
    if (!checkUser(questionId)) {
      return false;
    }
    if (files.some((file) => file.size > 9.9 * 1024 * 1024)) {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: t("quiz.file-too-large")}});
      return false;
    }

    const groupId = await getGroupId(userGroup, bookId);
    if (userGroup && groupId === null) {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: t("quiz.invalid-group")}
      });
      return false;
    }

    const {status, message } = await postFileAnswer({accessToken: user!.accessToken, group: userGroup, bookId, questionId});
    if (status === "error") {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: message || t("quiz.cant-upload-file")}
      });
      return false;
    }
    const errors = [];
    for(const file of files) {
      const formData = new FormData();
      formData.append("file", file);
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
      if (res.ok) {
        quizReducer({
          type: "ADDFILE",
          value: { questionId, file: path.basename(file.name) } // sanitize file name
        });
      }
      else {
        errors.push(file.name);
      }
    }
    if (errors.length) {
      quizReducer({
        type: "ERROR",
        value: {
          questionId,
          error: errors.length === files.length
            ? t("quiz.cant-upload-file")
            : `${t("quiz.cant-upload-some-files")} (${errors.join(", ")})`
        }
      });
      return false;
    }

    return true;
  }, [checkUser, user, userGroup, bookId, quizReducer, t]);

  const removeFile = React.useCallback(async (questionId: string, file: string) => {
    if (!checkUser(questionId)) {
      return false;
    }
    const groupId = await getGroupId(userGroup, bookId);
    if (userGroup && groupId === null) {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: t("quiz.invalid-group")}
      });
      return false;
    }
    const error = await removeFileFromServer(
      file === "*" ? undefined : file,
      {bookId, groupId, questionId, accessToken: user!.accessToken}
    );
    if (error) {
      quizReducer({
        type: "ERROR",
        value: {questionId, error: `${t("quiz.cant-remove-file")} (${error.message})`}
      });
      return false;
    }
    if (file === "*") {
      quizReducer({
        type: "REMOVEFILES",
        value: { questionId }
      });
    }
    else {
      quizReducer({
        type: "REMOVEFILE",
        value: {questionId, file}
      });
    }
    return true;
  }, [checkUser, user, userGroup, bookId, quizReducer, t]);

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
            acc + (answers[answers.length - 1]?.points ?? 0),
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
          acc + (answers[answers.length - 1]?.points ?? 0),
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
      getAnswers,
      getLastAnswer,
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
    getCorrectAnswer,
  } = React.useContext(QuizContext);
  const answers = (getAnswers(questionId) || []) as AnswerValueData[];
  const value = {
    attempts: answers.length,
    submissionErrored: submissionErrored(questionId),
    answerQuestion: async (value: AnswerValueData) => await aq({questionId, ...value}),
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
  const lastAnswer = getLastAnswer(questionId) as AnswerFile | null;
  return {
    files: lastAnswer?.files ?? [],
    attempts: lastAnswer ? 1 : 0,
    submissionErrored: submissionErrored(questionId),
    addFiles: async (files: File[]) => await addFiles(questionId, files),
    removeFile: async (fileName: string) => await removeFile(questionId, fileName),
    removeFiles: async () => await removeFile(questionId, "*")
  }
}
