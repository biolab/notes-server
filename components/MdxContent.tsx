"use client";
import { MDXRemote } from "next-mdx-remote";

const MdxContent = ({ content }: any) => {
  return <MDXRemote {...content} />;
};

export default MdxContent;
