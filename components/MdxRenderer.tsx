'use client';

import React from 'react';
import { MDXRemote, type MDXRemoteSerializeResult } from 'next-mdx-remote';
import { type MDXComponents } from 'mdx/types';
import CcByNcNd from './CcByNcNd';

export const MdxRenderer = ({ content, components }: { content: MDXRemoteSerializeResult, components?: MDXComponents}) => 
  <MDXRemote {...content} components={{ CcByNcNd, ...components }} />;