"use client";
import React, { useState, useEffect } from "react";
import { Layers, BookOpen, SquarePen, Trash } from "lucide-react";
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

const MOCK_COURSES: Course[] = [
  { id: 1, name: "HTML & CSS Cơ bản", slug: "html-css-basic" },
  { id: 2, name: "JavaScript Nâng cao", slug: "javascript-advanced" },
];
const INITIAL_CHAPTERS: Chapter[] = [
  // --- Khóa 1: HTML & CSS (ID: 1) ---
  {
    id: 101,
    course_id: 1,
    title: "Chương 1: Giới thiệu HTML & Cấu trúc trang",
    order_index: 1,
    created_at: "2023-10-01",
  },
  {
    id: 102,
    course_id: 1,
    title: "Chương 2: Các thẻ văn bản & Semantic Tags",
    order_index: 2,
    created_at: "2023-10-02",
  },
  {
    id: 103,
    course_id: 1,
    title: "Chương 3: CSS Basics: Selectors & Colors",
    order_index: 3,
    created_at: "2023-10-03",
  },
  {
    id: 104,
    course_id: 1,
    title: "Chương 4: Layout với Flexbox & Grid",
    order_index: 4,
    created_at: "2023-10-04",
  },
  {
    id: 105,
    course_id: 1,
    title: "Chương 5: Responsive Design & Media Queries",
    order_index: 5,
    created_at: "2023-10-05",
  },

  // --- Khóa 2: JavaScript (ID: 2) ---
  {
    id: 201,
    course_id: 2,
    title: "Chương 1: JS Syntax, Variables & Data Types",
    order_index: 1,
    created_at: "2023-11-01",
  },
  {
    id: 202,
    course_id: 2,
    title: "Chương 2: Cấu trúc điều khiển & Vòng lặp",
    order_index: 2,
    created_at: "2023-11-02",
  },
  {
    id: 203,
    course_id: 2,
    title: "Chương 3: Functions, Scope & Hoisting",
    order_index: 3,
    created_at: "2023-11-03",
  },
  {
    id: 204,
    course_id: 2,
    title: "Chương 4: DOM Manipulation & Events",
    order_index: 4,
    created_at: "2023-11-04",
  },
  {
    id: 205,
    course_id: 2,
    title: "Chương 5: Asynchronous JS (Promise, Async/Await)",
    order_index: 5,
    created_at: "2023-11-05",
  },
];
export default function ChaptersManagerPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<number>(
    MOCK_COURSES[0].id
  );
  const [chapters, setChapters] = useState<Chapter[]>(INITIAL_CHAPTERS);
  const filteredChapters = chapters
    .filter((chapter) => chapter.course_id === selectedCourseId)
    .sort((a, b) => a.order_index - b.order_index);
  const handleOrderChange = (chapterId: number, newOrder: string) => {};
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
                className="bg-[#2C3039] text-md p-3 rounded-md w-full"
                value={selectedCourseId || ""}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              >
                <option value="">Chọn khóa học</option>
                {MOCK_COURSES.map((course) => (
                  <option value={course.id} key={course.id}>
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
                <tbody className="bg-[#191C24]">
                    {INITIAL_CHAPTERS.map((chapter)=>(
                        <tr key={chapter.id}>
                            <td className="px-6 py-6">{chapter.id}</td>
                            <td className="px-6 py-6">{chapter.title}</td>
                            <td className="px-6 py-6">{chapter.order_index}</td>
                            <td className="px-6 py-6">{chapter.created_at}</td>
                            <td className="px-6 py-6"><SquarePen size={20} className=""/></td>
                        </tr>
                    ))}
                    
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
