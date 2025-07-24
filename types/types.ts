/* Questions */

export type QuestionTypes = "multi" | "text" | "long-text" | "choice";

export type QuestionDef = {
  id?: number;
  questionId: string;
  question: string;
  type: QuestionTypes;
  options: string[] | null;
  answer: string | null;
  line: number;
  points: number;
  optional: boolean;
};


/* Chapters */

export interface ChapterFrontmatter {
  title: string;
  omitAsChapter?: boolean;
  date: string;
}

export interface ChapterDefBase {
  chapterDir: string;
  frontmatter: ChapterFrontmatter;
  questions: QuestionDef[];
}

export interface ChapterDef extends ChapterDefBase {
  content: string;
}


/* Books */

export interface BookFrontmatter {
  title: string;
  subTitle: string;
  date: string;
  public: boolean;
  language: string;
  tocInHeader: boolean;
  coverImg: string;
  requireLogin: boolean;
  quizThreshold?: number;
  chapters?: string[];
  loginSubtitle?: string;
  email?: { subject: string; body: string };
}


/* Collections */

export interface CollectionFrontmatter {
  title: string;
  subTitle: string;
  date: string;
  public: boolean;
  language: string;
  coverImg: string;
  recursiveContent: boolean;
  books?: string[];
  collections?: string[];
}

export const defaultCollectionFrontmatter: CollectionFrontmatter = {
  title: "",
  subTitle: "",
  date: "",
  public: true,
  language: "en",
  coverImg: "",
  recursiveContent: false,
};

export const extraCollectionMatter = {
  books: [] as string[],
  collections: [] as string[],
} satisfies Record<string, unknown>;

