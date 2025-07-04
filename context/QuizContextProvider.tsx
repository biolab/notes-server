import { EventTypes } from "@/components/Quiz/Quiz";
import { QuizService_PostState } from "@/server-functions/QuizService";
import { ChapterDef } from "@/types/types";
import React, { useReducer } from "react";
import { UserContext } from "./UserContextProvider";

// Bump quiz version if interface changes
export const QUIZ_VERSION = 2;

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
  _quizState?: QuizStateI | null;
}): QuizStateI => {
  if (_quizState) {
    return _quizState;
  }

  const state = {
    book_title: title,
    slug,
    questions: getQuestionsFromChapters(chapters),
    chaptersWithQuiz: chapters
      .map((chapter, index) => (chapter.questions?.length ? index : -1))
      .filter((index) => index !== -1),
    quizThreshold,
    isQuizComplete: false,
  };

  return state;
};

const reducer = (
  state: QuizStateI,
  action: {
    type: string;
    value: AnswerI;
  }
) => {
  const { type, value } = action;

  switch (type) {
    case "ANSWER_QUIZ":
      const _state = {
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
  quizReducer: React.Dispatch<{ type: string; value: AnswerI }>;
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
  quizState?: QuizStateI | null; // Optional initial quiz state
}) => {
  const [quizState, quizReducer]: [
    QuizStateI,
    React.Dispatch<{ type: string; value: AnswerI }>
  ] = useReducer(
    reducer,
    getQuizState({ title, slug, quizThreshold, _quizState, chapters })
  );

  // const { track, postState } = useTracking();
  // const postState = (props) => null; // Mocked for this example
  const track = (props) => null; // Mocked for this example

  const { user } = React.useContext(UserContext);
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
    if (quizState.questions.some((q) => q.answers?.length)) {
      try {
        QuizService_PostState({
          quizState,
          user,
          slug,
          quizVersion: QUIZ_VERSION,
        });
      } catch (error) {
        console.log(error);
      }
    }
  }, [quizState, isQuizComplete, track, user, slug]);

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
