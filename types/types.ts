import { QuestionDef } from '@/utils/preflight';
import { MDXRemoteSerializeResult } from "next-mdx-remote";

export interface ChapterFrontmatter {
  title: string;
  omitAsChapter?: boolean;
  date: string;
  comment: string;
}

export const defaultChapterFrontmatter: ChapterFrontmatter = {
  title: "",
  omitAsChapter: false,
  date: "",
  /* TODO: Fix books and remove */
  comment: "",
};

export interface ChapterDef {
  frontmatter: ChapterFrontmatter;
  content: MDXRemoteSerializeResult;
  questions: QuestionDef[];
}

export interface BookFrontmatter {
  title: string;
  subTitle: string;
  description: string;
  date: string;
  public: boolean;
  language: string;
  tocInHeader: boolean;
  indexInitiallyClosed?: boolean;
  coverImg: string;
  chapters?: string[];
}

export const defaultBookFrontmatter: BookFrontmatter = {
  title: "",
  subTitle: "",
  description: "",
  date: "",
  public: true,
  language: "en",
  tocInHeader: false,
  indexInitiallyClosed: false,
  coverImg: "",
} satisfies BookFrontmatter & Record<string, unknown>;

export const extraBookMatter = {
  chapters: [] as string[],

  /* TODO: These are related to quizzes. I listed them here so that
       current books pass validation, but they should be moved to
       defaultBookFrontmatter or removed if they're no longer necessary. */
  showQuizProgress: false,
  requireLogin: false,
  quizThreshold: 0,
  submitQuizText: "",
  loginSubtitle: "",
  email: {},

  // Unended properties
  quiz: false,
  logQuizzes: false,
} satisfies Record<string, unknown>;

export interface CollectionFrontmatter {
  title: string;
  subTitle: string;
  date: string;
  description: string;
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
  description: "",
  public: true,
  language: "en",
  coverImg: "",
  recursiveContent: false,
};

export const extraCollectionMatter = {
  books: [] as string[],
  collections: [] as string[],
} satisfies Record<string, unknown>;
