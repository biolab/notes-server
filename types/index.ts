/* Questions */

export type QuestionTypes = "singlechoice" | "text" | "long-text" | "upload" | "uploads";

export type QuestionDef = {
  id?: number;
  questionId: string;
  question: string;
  type: QuestionTypes;
  options: string[] | null;
  answer: string | null;
  maxPoints: number | null;
  maxAttempts: number | null;
};


/* Chapters */

export interface ChapterFrontmatter {
  title: string;
  omitAsChapter?: boolean;
}

export interface ChapterDefBase {
  chapterPath: string;
  frontmatter: ChapterFrontmatter;
  questions: QuestionDef[];
}

export interface ChapterDef extends ChapterDefBase {
  content: string;
  chapterId: number;
}


/* Books */
export const UnlockChaptersOnAnswersOptions = ["none", "attempt", "correct"] as const
export type UnlockChaptersOnAnswersType = typeof UnlockChaptersOnAnswersOptions[number];

export interface BookFrontmatterBase {
  title: string;
  subTitle: string;
  public: boolean;
  language: string;
  tocInHeader: boolean;
  coverImg: string;
  requireLogin: boolean;
  quizThreshold?: number;
  unlockChaptersOnAnswers: UnlockChaptersOnAnswersType;
  env: Record<string, any>;
  chapters?: string[];
}

export interface RawBookFrontmatter extends BookFrontmatterBase {
  groups?: string[] | {[token: string]: string};
  tokens?: string[];
  admins?: string[];
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
  admins?: string[];
}

export const defaultCollectionFrontmatter: CollectionFrontmatter = {
  title: "",
  subTitle: "",
  public: true,
  language: "",
  coverImg: "",
  recursiveContent: false,
};

export const extraCollectionMatter = {
  books: [] as string[],
  collections: [] as string[],
  admins: [] as string[],
} satisfies Record<string, unknown>;

export type LinkDesc = { href: string, title: string } | false;


export const resources = {
  favicon: {file: "favicon.png", db: true},
  css: {file: "style.css", db: true},
  defaults: {file: "defaults.yml", db: false},
} as const;

export type ResourceType = keyof typeof resources;

export type InheritableResources = {
  type: ResourceType;
  path: string;
  db: boolean;
}[];
