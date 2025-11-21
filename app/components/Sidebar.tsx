"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type lessonItem = {
  id: number;
  title: string;
  slug: string;
};

export default function Sidebar({ lessons }: { lessons: lessonItem[] }) {
  const pathName = usePathname();
  return (
    <aside className="flex px-2 py-4 gap-3 w-1/4 bg-slate-50 min-h-screen">
      <div className="flex flex-col bg-gray-500 w-full rounded-xl">
        <h1 className="p-4 text-2xl text-black">HTML & CSS</h1>
        {lessons.map((lesson) => {
          const isActive = pathName === `/learn/${lesson.slug}`;
          return (
            <Link
              key={lesson.id}
              href={lesson.slug}
              className={`hover:bg-blue-500 hover:text-white p-3 ${
                isActive ? "bg-blue-500 text-white font-bold" : "text-black"
              }`}
            >
              {lesson.title}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
