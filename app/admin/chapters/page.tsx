"use client";
import React, { useState, useEffect } from "react";
import { Layers, BookOpen, SquarePen, Trash } from "lucide-react";
import { getCourseChapterManager, getChapterForChapterManager } from "@/lib/supabase";

interface Course {
  id: number;
  name: string;
  slug: string;
}

interface Chapter {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  created_at: string;
}



export default function ChaptersManagerPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number|null>(
    null
  );
  const filteredChapters = chapters
    .filter((chapter) => chapter.course_id === selectedCourseId)
    .sort((a, b) => a.order_index - b.order_index);
  const handleOrderChange = (chapterId: number, newOrder: string) => {};

  useEffect(() => {
    const fetchCourses = async () => {
      const data = await getCourseChapterManager();
      setCourses(data);
    };
    fetchCourses();
  }, []);  

  useEffect(() => {
    const fetchChapters = async () => {
      const data = await getChapterForChapterManager();
      setChapters(data);
    };
    fetchChapters(); 
  }, []);

  return (
    <div className="bg-[#0F1116] w-full h-screen">
      <div className="p-4 flex flex-col gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl flex items-center gap-2">
            <Layers className="text-[#3B81F4]" size={30} />
            Quản lý chương học
          </h1>
          <p className="text-sm text-gray-400">
            Sắp xếp và tổ chức nội dung bài học theo cấu trúc.
          </p>
        </div>
        <div className="bg-[#0F1116]">
          <div className="bg-[#191C24] flex p-4 gap-2 items-center rounded-xl">
            <div className="flex items-center gap-2 w-1/2 bg-[#2C3039] h-1/2 p-4 rounded-xl">
              <BookOpen className="text-[#3B81F4]" size={20} />
              <div className="flex flex-col">
                <p className="text-sm text-gray-400">KHÓA HỌC HIỆN TẠI</p>
                <p className="text-md font-bold">HTML & CSS Cơ bản</p>
              </div>
            </div>
            <div className="w-1/2 flex flex-col gap-3">
              <p className="text-sm text-gray-400">CHUYỂN KHÓA HỌC</p>
              <select
                name=""
                id=""
                className="bg-[#2C3039] text-md p-3 rounded-md w-full uppercase"
                value={selectedCourseId || ""}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              >
                <option className="uppercase" value="">Chọn khóa học</option>
                {courses.map((course) => (
                  <option className="uppercase" value={course.id} key={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="w-full p-4">
            <table className="w-full">
                <thead>
                    <tr className="bg-[#222732]">
                        <th scope="col" className="px-6 py-6 text-md">ID</th>
                        <th scope="col" className="px-6 py-6 text-md">TÊN CHƯƠNG</th>
                        <th scope="col" className="px-6 py-6 text-md">THỨ TỰ</th>
                        <th scope="col" className="px-6 py-6 text-md">NGÀY TẠO</th>
                        <th scope="col" className="px-6 py-6 text-md">HÀNH ĐỘNG</th>
                    </tr>
                </thead>
                { <tbody className="bg-[#191C24]">
                    {filteredChapters.map((chapter)=>(
                        <tr key={chapter.id}>
                            <td className="px-6 py-6">{chapter.id}</td>
                            <td className="px-6 py-6">{chapter.title}</td>
                            <td className="px-6 py-6">{chapter.order_index}</td>
                            <td className="px-6 py-6">{chapter.created_at}</td>
                            <td className="px-6 py-6"><SquarePen size={20} className=""/></td>
                        </tr>
                    ))}
                    
                </tbody> }
            </table>
        </div>
      </div>
    </div>
  );
}
