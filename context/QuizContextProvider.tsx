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

export type AnswerState = Answer & {
  questionId: string;
  nAttempts: number;
}

export interface QuestionI {
  questionId: string;
  maxPoints: number;
  maxAttempts: number;
  chapterIndex: number;
  lastAnswer: Answer | null;
  nAttempts: number;
  submissionErrored?: boolean | string;
  correctAnswer?: string;
}

type Questions = {[questionID: string]: QuestionI};

export interface QuizStateI {
  questions: Questions;
  quizThreshold: number;
}

const getQuestionsFromChapters = (chapters: ChapterDef[]): Questions =>
  Object.fromEntries(
    chapters.flatMap((chapter, chapterIndex) =>
      (chapter.questions || []).map(({questionId, maxPoints, maxAttempts}) => [
        questionId,
        {
          questionId,
          maxPoints: maxPoints ?? 1,
          maxAttempts: maxAttempts ?? 0,
          nAttempts: 0,
          chapterIndex,
          lastAnswer: null,
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
  answers: AnswerState[] | null;
  correctAnswers: CorrectAnswers
}) => {
  const state: QuizStateI = {
    questions: getQuestionsFromChapters(chapters),
    quizThreshold,
  };
  (answers || []).forEach((answer) => {
    const {questionId, ...answerWOutId} = answer;
    state.questions[questionId].lastAnswer = (answerWOutId as Answer);
    state.questions[questionId].nAttempts = answer.nAttempts;
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
          lastAnswer: {type: "value", ...data},
          nAttempts: (prev?.nAttempts ?? 0) + 1
        }
      }
      break;
    }

    case "REMOVEFILE": {
      if (!prev?.lastAnswer) {
        return state;
      }
      const prevFiles = (prev.lastAnswer as AnswerFile).files;
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          lastAnswer: {
            type: "files",
            files: prevFiles.filter((n) => n !== action.value.file),
          } as AnswerFile
        }
      }
      break;
    }

    case "REMOVEFILES": {
      if (!prev?.lastAnswer) {
        return state;
      }
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          lastAnswer: { type: "files", files: [] } as AnswerFile
        }
      }
      break;
    }

    case "ADDFILE": {
      const prevFiles = (prev?.lastAnswer as AnswerFile | null)?.files || [] as string[];
      questions = {
        ...state.questions,
        [questionId]: {
          ...prev,
          submissionErrored: false,
          lastAnswer:
            {type: "files", files: [...prevFiles.filter((f) => f !== action.value.file), action.value.file]}
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
  batchSubmission?: boolean;
  answerQuestion: ({questionId, answer, isCorrect, points}: AnswerValueData & { questionId: string }) => Promise<boolean>;
  addFiles: (questionId: string, files: File[]) => Promise<boolean>;
  removeFile: (questionId: string, fileName: string) => Promise<boolean>;
  sendAnswer: (questionId: string) => Promise<AnswerValueData & { questionId: string } | false>;
  recordAnswerLocally: (value: AnswerValueData & { questionId: string, correctAnswer?: string }) => void;
  getLastAnswer: (questionId: string) => Answer | null;
  displayedAnswer: (questionId: string) => string | null;
  getAttempts: (questionId: string) => number;
  getCorrectAnswer: (questionId: string) => string | undefined;
  submissionErrored: (questionId: string) => boolean | string;
  getQuestionSettings: (questionId: string) => { maxPoints: number, maxAttempts: number };
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
  sendAnswer: async () => false,
  recordAnswerLocally: () => {},
  batchSubmission: false,
  getLastAnswer: () => null,
  displayedAnswer: () => null,
  getAttempts: () => 0,
  getCorrectAnswer: () => undefined,
  submissionErrored: () => false,
  getQuestionSettings: () => ({ maxPoints: 1, maxAttempts: 0 }),
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
  batchSubmission,
}: {
  children: React.ReactNode;
  quizThreshold: number;
  chapters: ChapterDef[];
  bookId: number;
  answers: AnswerState[] | null;
  correctAnswers: { questionId: string, answer: string}[];
  batchSubmission?: boolean;
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

  const sendAnswer = React.useCallback(async (answer: AnswerValueData & { questionId: string }): Promise<PostAnswerResult> => {
    const sendResult: PostAnswerResult = await (async () => {
      if (!user) {
        return {status: "error", message: t("quiz.not-logged-in")};
      }
      try {
        return await postAnswer({
          accessToken: user.accessToken, group: userGroup, bookId,
          ...answer});
      } catch (error: any) {
        return {status: "error", message: t("quiz.submission-error")};
      }
      })();
    if (sendResult.status === "error") {
      quizReducer({
        type: "ERROR",
        value: {questionId: answer.questionId, error: sendResult.message}});
    }
    return sendResult;
  }, [user, bookId, userGroup, t]);

  const sendAnswerById = React.useCallback(async (questionId: string): Promise<AnswerValueData & { questionId: string } | false> => {
    // Upload questions cannot appear in batch submission, so we can cast to AnswerValueData safely
    const lastAnswer = quizState.questions[questionId]?.lastAnswer as AnswerValue | undefined | null;
    if (!lastAnswer) {
      quizReducer({type: "ERROR", value: {questionId, error: "No answer to submit"}});
      return false;
    }

    const answerToSend: AnswerValueData & { questionId: string } = {
      questionId,
      answer: lastAnswer.answer,
      isCorrect: lastAnswer.isCorrect,
      points: lastAnswer.points
    };
    const sendResult = await sendAnswer(answerToSend);
    if (sendResult.status === "ok") {
      return {
        ...answerToSend,
        isCorrect: sendResult.isCorrect,
        points: sendResult.points
      }
    }
    else {
      return false;
    }
  }, [quizState, sendAnswer, t]);

  const recordAnswerLocally = React.useCallback(
    (answer: AnswerValueData & { questionId: string, correctAnswer?: string }) => {
      quizReducer({type: "ANSWER", value: answer});
    }, [quizReducer]);

  const answerQuestion = React.useCallback(
    async (answer: AnswerValueData & { questionId: string}): Promise<boolean> => {
      const postResult = await sendAnswer(answer);
      if (postResult.status == "ok") {
        recordAnswerLocally({...answer, ...postResult});
        return true;
      }
      else {
        return false;
      }
    },
    [sendAnswer, recordAnswerLocally]
  );

  const getLastAnswer = React.useCallback(
    (questionId: string) => quizState.questions[questionId]?.lastAnswer,
    [quizState]
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
        const answered = questionsInChapter.filter((q) => !!q.lastAnswer).length;
        const correct = questionsInChapter.filter((q) => q.lastAnswer?.isCorrect === true).length;
        const wrong = questionsInChapter.filter((q) => q.lastAnswer?.isCorrect === false).length;
        const achievedPoints = questionsInChapter.reduce((acc, {lastAnswer}) => acc + (lastAnswer?.points ?? 0), 0);
        const correctness = questionsInChapter.map((q) => q.lastAnswer ? q.lastAnswer.isCorrect : null);
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

      correct: Object.values(quizState.questions).filter((q) => q.lastAnswer?.isCorrect === true).length,
      wrong: Object.values(quizState.questions).filter((q) => q.lastAnswer?.isCorrect === false).length,
      answered: Object.values(quizState.questions).filter((q) => !!q.lastAnswer).length,
      achievedPoints: Object.values(quizState.questions).reduce((acc, {lastAnswer}) => acc + (lastAnswer?.points ?? 0), 0),
    }),
    [quizState]
  );

  const getQuestionSettings = React.useCallback((questionId: string) => {
    const question = quizState.questions[questionId];
    if (!question) {
      return { maxPoints: 1, maxAttempts: 0 };
    }
    return {
      maxPoints: question.maxPoints,
      maxAttempts: question.maxAttempts
    }
  }, [quizState]
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
      sendAnswer: sendAnswerById,
      recordAnswerLocally,
      batchSubmission,
      chapterStats,
      getCorrectAnswer: (questionId: string) => quizState.questions[questionId]?.correctAnswer,
      getLastAnswer,
      getQuestionSettings,
      displayedAnswer: (questionId: string) => (quizState.questions[questionId]?.lastAnswer as (AnswerValue | null))?.answer || null,
      getAttempts: (questionId: string) => quizState.questions[questionId]?.nAttempts ?? 0,
      submissionErrored: (questionId: string) => quizState.questions[questionId]?.submissionErrored || false
    }),
    [
      quizState,
      answerQuestion,
      getLastAnswer,
      getQuestionSettings,
      addFiles,
      removeFile,
      sendAnswerById,
      recordAnswerLocally,
      batchSubmission,
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
    getAttempts,
    submissionErrored,
    answerQuestion: aq,
    getLastAnswer,
    getCorrectAnswer,
  } = React.useContext(QuizContext);
  const answer = getLastAnswer(questionId) as AnswerValueData;
  const value = {
    attempts: getAttempts(questionId),
    submissionErrored: submissionErrored(questionId),
    answerQuestion: async (value: AnswerValueData) => await aq({questionId, ...value}),
    correctAnswer: getCorrectAnswer(questionId)
  };
  if (!answer) {
    return {
      ...value,
      isCorrect: null,
      answer: null,
      correctAnswer: null,
      attempts: 0,
      points: null}
  }
  return {...value, ...answer }
}

export const useFileAnswer = (questionId: string) => {
  const { getLastAnswer, submissionErrored, addFiles, removeFile } = React.useContext(QuizContext);
  const lastAnswer = getLastAnswer(questionId) as (AnswerFile | null);
  return {
    files: lastAnswer?.files ?? [],
    attempts: lastAnswer ? 1 : 0,
    submissionErrored: submissionErrored(questionId),
    addFiles: async (files: File[]) => await addFiles(questionId, files),
    removeFile: async (fileName: string) => await removeFile(questionId, fileName),
    removeFiles: async () => await removeFile(questionId, "*")
  }
}

export const useBatchSubmission = () => {
  const { batchSubmission } = React.useContext(QuizContext);
  return batchSubmission;
}
