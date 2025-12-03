"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, getCompletedLessonIds } from "@/lib/supabase";
import { useEffect, useState } from "react";

type SidebarProps = {
  lessons: { id: number; title: string; slug: string }[];
  courseSlug: string;
};

export default function Sidebar({ lessons, courseSlug }: SidebarProps) {
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const pathName = usePathname();

  useEffect(() => {
    const fetchProgress = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const result = await getCompletedLessonIds(session.user.id);
        setCompletedIds(result);
      } else {
        console.log("Bạn chưa đăng nhập");
      }
    };
    fetchProgress();
  }, []);

  return (
    <aside className="flex px-2 py-4 gap-3 w-1/4 bg-slate-50 min-h-screen">
      <div className="flex flex-col bg-gray-500 w-full rounded-xl">
        <h1 className="p-4 text-2xl text-black">HTML & CSS</h1>
        {lessons.map((lesson) => {
          const isActive = pathName === `/learn/${lesson.slug}`;
          const isCompleted = completedIds.includes(lesson.id);
          return (
            <Link
              key={lesson.id}
              href={`/learn/${courseSlug}/${lesson.slug}`}
              className={`hover:bg-blue-500 hover:text-white p-3 ${
                isActive ? "bg-blue-500 text-white font-bold" : "text-black"
              }`}
            >
              <span>{lesson.title}</span>
              {isCompleted && (
                <span className="text-green-500 font-bold ml-4 text-xl">✓</span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}