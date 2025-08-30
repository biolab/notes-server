/* Questions */

export type QuestionTypes = "singlechoice" | "text" | "long-text";

export type QuestionDef = {
  id?: number;
  questionId: string;
  question: string;
  type: QuestionTypes;
  options: string[] | null;
  answer: string | null;
  points: number | null;
};


/* Chapters */

export interface ChapterFrontmatter {
  title: string;
  omitAsChapter?: boolean;
}

export interface ChapterDefBase {
  chapterDir: string;
  frontmatter: ChapterFrontmatter;
  questions: QuestionDef[];
}

export interface ChapterDef extends ChapterDefBase {
  content: string;
  chapterId: number;
}


/* Books */

export interface BookFrontmatterBase {
  title: string;
  subTitle: string;
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

export interface RawBookFrontmatter extends BookFrontmatterBase {
  groups?: string[] | {[token: string]: string};
  tokens?: string[];
}

export interface BookFrontmatter extends BookFrontmatterBase {
  groups: [string, string][];
}

/* Collections */

export interface CollectionFrontmatter {
  title: string;
  subTitle: string;
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
  public: true,
  language: "en",
  coverImg: "",
  recursiveContent: false,
};

export const extraCollectionMatter = {
  books: [] as string[],
  collections: [] as string[],
} satisfies Record<string, unknown>;

