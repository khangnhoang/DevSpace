"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, getCompletedLessonIds, type Chapter } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";

type SidebarProps = {
  chapters: Chapter[];
  courseSlug: string;
};


export default function Sidebar({ chapters, courseSlug }: SidebarProps) {
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});
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

  const toggleChapter = (id: number) => {
    setOpenChapters((prev) => ({
      ...prev, 
      [id]: !prev[id],
    }));
  };

  return (
    <aside className="flex px-2 py-4 gap-3 w-1/4 bg-slate-50 min-h-screen">
      <div className="flex flex-col bg-gray-200 w-full rounded-xl shadow-2xl">
        <h1 className="p-4 text-3xl text-black font-bold">HTML & CSS</h1>
        <div className="">
            {chapters.map((chapter) => {
              const isActiveChapter = chapter.lessons?.some((l) => pathName === `/learn/${courseSlug}/${l.slug}`) ?? false;
              const isOpen = openChapters[chapter.id] ?? isActiveChapter;
              return (<div key= {chapter.id} className="select-none w-full">
                <button type="button" onClick={() => toggleChapter(chapter.id)} className="w-full">
                  <span className="text-black flex items-center hover:bg-gray-300 w-full p-3 text-md cursor-pointer">
                    {chapter.title}
                    {isOpen ? (
                      <ChevronDown size={16} className="text-black"/>
                    ) : (
                      <ChevronRight size={16} className="text-black"/>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div>
                    {chapter.lessons.map((lesson) => {
                      const isActive = pathName === `/learn/${courseSlug}/${lesson.slug}`;
                      const isCompleted = completedIds.includes(lesson.id);
              return (
                <Link
                  key={lesson.id}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  className={`hover:bg-gray-300 text-black p-3 flex ${
                    isActive ? "bg-blue-500 text-white font-bold" : "text-black"
                  }`}
                >
                  <span>{lesson.title}</span>
                  {isCompleted && (
                    <Check className="text-green-500 font-bold ml-4 text-xl" size={16} strokeWidth={3}/>                
                  )}
                </Link>
              );
                    })}
                  </div>
                )}
              </div>)
            })}     
        </div>
      </div>
    </aside>
  );
}
