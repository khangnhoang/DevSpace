// components/LessonContent.tsx
import { MDXRemote } from "next-mdx-remote/rsc";
import PreBlock from "./PreBlock";

interface Props {
  content: string;
}

const components = {
  pre: PreBlock,
};

export default function LessonContent({ content }: Props) {
  return (
    <article className="prose lg:prose-xl max-w-none prose-headings:text-blue-700 prose-pre:bg-gray-900 prose-pre:text-white">
      {/* Đây là hàm dịch Markdown -> HTML */}
      <MDXRemote source={content} components={components} />
    </article>
  );
}
