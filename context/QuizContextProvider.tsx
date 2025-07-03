import { EventTypes } from "@/components/Quiz/Quiz";
import { ChapterDef } from "@/types/types";
import React, { useReducer } from "react";
import getUuid from "uuid-by-string";

// import { UserContext } from "./UserContext";

// Bump quiz version if interface changes
const QUIZ_VERSION = "1";

export const getBookId = (title: string, slug: string) =>
  getUuid(title + slug + QUIZ_VERSION);

export interface AnswerI {
  question_id: string;
  question: string;
  max_trials?: number;
  isCorrect?: boolean;
  isNeutral?: boolean;
  answer?: string | string[];
  timestamp?: number;
  points?: number;
  trial?: number;
  available_points?: number;
}

export interface QuestionI {
  question_id: string;
  question: string;
  possiblePoints: number;
  chapterIndex: number;
  max_trials?: number;
  answers: AnswerI[];
  optional: boolean;
}

export interface QuizStateI {
  book_id: string;
  book_title: string;
  slug: string;
  isQuizComplete?: boolean;
  questions: QuestionI[];
  chaptersWithQuiz: number[];
  activeChapters: number[];
  quizThreshold: number;
}

const getQuestionsFromChapters = (chapters: ChapterDef[]): QuestionI[] => {
  return chapters.flatMap((chapter, chapterIndex) => {
    return (chapter.questions || []).map((question) => ({
      question_id: question.questionId,
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
  _quizState,
}: {
  title: string;
  slug: string;
  chapters: ChapterDef[];
  quizThreshold: number;
  _quizState?: QuizStateI;
}): QuizStateI => {
  if (_quizState) {
    return _quizState;
  }

  const book_id = getBookId(title, slug);

  const state = {
    book_id,
    book_title: title,
    slug,
    questions: getQuestionsFromChapters(chapters),
    chaptersWithQuiz: chapters
      .map((chapter, index) => (chapter.questions?.length ? index : -1))
      .filter((index) => index !== -1),
    activeChapters: [],
    quizThreshold,
  };

  return state;
};

const reducer = (state, action) => {
  const { type, value } = action;

  switch (type) {
    case "COMPLETE":
      return {
        ...state,
        isQuizComplete: true,
      };

    case "ANSWER_QUIZ":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.question_id === value.question_id
            ? {
                ...q,
                answers: [...(q.answers || []), value],
              }
            : q
        ),
      };
    default:
      break;
  }
};

export const QuizContext = React.createContext<{
  quizState: QuizStateI | null;
  quizReducer: React.Dispatch<{ type: string; value?: unknown }>;
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
  submissionEmail,
  chapters,
  quizState: _quizState,
}: {
  children: React.ReactNode;
  title: string;
  quizThreshold: number;
  slug: string;
  chapters: ChapterDef[];
  submissionEmail?: string;
  quizState?: QuizStateI; // Optional initial quiz state
}) => {
  const [quizState, quizReducer]: [
    QuizStateI,
    React.Dispatch<{ type: string; value?: unknown }>
  ] = useReducer(
    reducer,
    getQuizState({ title, slug, quizThreshold, _quizState, chapters })
  );
  // const { track, postState } = useTracking();
  const postState = (props) => null; // Mocked for this example
  const track = (props) => null; // Mocked for this example

  // const { user } = React.useContext(UserContext);
  const [userLoginTracked, setUserLoginTracked] = React.useState(false);

  React.useEffect(() => {
    if (userLoginTracked) {
      return;
    }

    track({
      type: EventTypes.USER_LOGIN,
      value: {
        timestamp: Date.now(),
      },
      _quizState: quizState,
    });

    setUserLoginTracked(true);
  }, [quizState, track, userLoginTracked]);

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

  React.useEffect(() => {
    if (
      quizState.questions.some((q) => q.answers?.length) ||
      quizState.activeChapters.length
    ) {
      postState({ quizState });
    }
  }, [quizState, isQuizComplete, track, postState]);

  const submitQuiz = React.useCallback(() => {
    if (isQuizComplete && !quizState.isQuizComplete) {
      track({
        type: EventTypes.QUIZ_COMPLETED,
        value: quizState,
        submissionEmail,
        _quizState: quizState,
      });

      quizReducer({ type: "COMPLETE" });
    }
  }, [isQuizComplete, quizState, submissionEmail, track]);

  const contextValue = React.useMemo(
    () => ({
      quizState,
      quizReducer,
      submitQuiz,
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
      submitQuiz,
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
