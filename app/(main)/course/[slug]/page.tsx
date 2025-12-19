'use client';
import React, { useState } from 'react';

import { Check, CircleFadingArrowUp, Film, Clock, BatteryFull, PlayCircle, Plus, Minus } from 'lucide-react';

const COURSE_DETAIL = {
  id: 1,
  title: "Lập Trình JavaScript Cơ Bản",
  slug: "javascript-co-ban",
  description: "Học Javascript cơ bản phù hợp cho người chưa từng học lập trình. Với hơn 100 bài học và có bài tập thực hành sau mỗi bài học.",
  thumbnail_url: "https://files.fullstack.edu.vn/f8-prod/courses/1.png",
  price: 0, // 0 là miễn phí
  price_text: "MIỄN PHÍ",
  
  // Các thông số bên phải (sidebar)
  stats: {
    level: "Trình độ cơ bản",
    lesson_count: 100, // Update theo description thực tế
    duration: "29 giờ 13 phút",
    accessibility: "Học mọi lúc, mọi nơi"
  },

  // Mục "Bạn sẽ học được gì?"
  learning_outcomes: [
    "Hiểu chi tiết về các khái niệm cơ bản trong JS",
    "Tự tin khi phỏng vấn với kiến thức vững chắc",
    "Nắm chắc các tính năng trong phiên bản ES6",
    "Ghi nhớ các khái niệm nhờ bài tập trắc nghiệm",
    "Các bài thực hành như Tabs, Music Player",
    "Xây dựng được website đầu tiên kết hợp với JS",
    "Có nền tảng để học các thư viện và framework JS",
    "Thành thạo DOM APIs để tương tác với trang web",
    "Nâng cao tư duy với các bài kiểm tra với testcases",
    "Nhận chứng chỉ khóa học do F8 cấp"
  ],

  // Mục "Nội dung khóa học" (Curriculum)
  chapters: [
    {
      id: 101,
      title: "Chương 1: Giới thiệu",
      total_lessons: 3,
      lessons: [
        { id: 1, title: "Giới thiệu khóa học", duration: "01:20", type: "video" },
        { id: 2, title: "Lời khuyên trước khi học", duration: "02:15", type: "video" },
        { id: 3, title: "Thuật ngữ kỹ thuật cần biết", duration: "03:10", type: "reading" }
      ]
    },
    {
      id: 102,
      title: "Chương 2: Làm quen với JavaScript",
      total_lessons: 4,
      lessons: [
        { id: 4, title: "Cách JS hoạt động", duration: "05:30", type: "video" },
        { id: 5, title: "Biến và Khai báo biến", duration: "08:12", type: "video" },
        { id: 6, title: "Kiểu dữ liệu", duration: "06:45", type: "video" },
        { id: 7, title: "Bài tập về biến", duration: "00:00", type: "quiz" }
      ]
    },
    {
      id: 103,
      title: "Chương 3: Toán tử và Cấu trúc điều kiện",
      total_lessons: 5,
      lessons: [
        { id: 8, title: "Toán tử số học", duration: "04:20", type: "video" },
        { id: 9, title: "Toán tử so sánh", duration: "05:15", type: "video" },
        { id: 10, title: "Toán tử logic", duration: "06:10", type: "video" },
        { id: 11, title: "Câu lệnh If - Else", duration: "07:30", type: "video" },
        { id: 12, title: "Bài tập If - Else", duration: "00:00", type: "quiz" }
      ]
    },
    {
      id: 104,
      title: "Chương 4: Hàm (Functions)",
      total_lessons: 3,
      lessons: [
        { id: 13, title: "Khái niệm hàm", duration: "10:00", type: "video" },
        { id: 14, title: "Tham số trong hàm", duration: "08:45", type: "video" },
        { id: 15, title: "Từ khóa Return", duration: "05:20", type: "video" }
      ]
    },
    {
      id: 105,
      title: "Chương 5: Mảng và Đối tượng (Array & Object)",
      total_lessons: 4,
      lessons: [
        { id: 16, title: "Làm việc với Mảng", duration: "12:10", type: "video" },
        { id: 17, title: "Làm việc với Object", duration: "11:05", type: "video" },
        { id: 18, title: "Object Constructor", duration: "09:30", type: "video" },
        { id: 19, title: "Object Prototype", duration: "07:15", type: "video" }
      ]
    },
    {
      id: 106,
      title: "Chương 6: Vòng lặp (Loop)",
      total_lessons: 3,
      lessons: [
        { id: 20, title: "Vòng lặp For", duration: "06:50", type: "video" },
        { id: 21, title: "Vòng lặp While", duration: "05:40", type: "video" },
        { id: 22, title: "Đệ quy", duration: "08:20", type: "video" }
      ]
    }
  ]
};

export default function DetailPage(){
    const [expandedChapters, setExpandedChapters] = useState<number[]>([101]);

    const toggleChapter = (id: number) => {
        setExpandedChapters(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        )
    }

    const handleExpandAll = () => {
        const allIds = COURSE_DETAIL.chapters.map(c => c.id)
        if(expandedChapters.length === allIds.length){
            setExpandedChapters([])
        }else{
            setExpandedChapters(allIds)
        }
    }

    const totalLessons = COURSE_DETAIL.chapters.reduce((acc, curr) => acc + curr.lessons.length,0)

    return(
        <div className="bg-[#111827] w-full min-h-screen p-4 flex md:p-8 flex-col lg:flex-row gap-8 justify-center">
            <div className="w-full lg:w-2/3 flex flex-col gap-8">
                <div className="w-full flex flex-col gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold">Lập Trình JavaScript Cơ Bản</h1>
                    <p className="text-sm leading-relaxed">Học Javascript cơ bản phù hợp cho người chưa từng học lập trình. Với hơn 100 bài học và có bài tập thực hành sau mỗi bài học.</p>
                </div>
                <div className="flex flex-col gap-4">
                    <h1 className="text-xl md:text-2xl font-bold">Bạn sẽ học được gì?</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {COURSE_DETAIL.learning_outcomes.map((item,index) =>(
                        <div key={index} className='flex gap-3 items-start'>
                          <Check size={20} className='text-blue-400'/>
                          <p className='text-gray-400'>{item}</p>
                        </div>
                      ))}
                    </div>
                </div>

                <div>
                    <div className='flex flex-col gap-4'>
                        <p className='text-xl md:text-2xl font-bold'>Nội dung khóa học</p>
                        <div className='flex justify-between items-end flex-wrap gap-2'>
                            <div className='flex gap-2 text-sm flex-wrap'>
                                <p className='font-bold'>6</p>
                                <p className=''>chương</p>
                                <p className='font-bold'>.</p>
                                <p className='font-bold'>30</p>
                                <p className=''>bài học</p>
                                <p className='font-bold'>.</p>
                                <p className=''>Thời lượng</p>
                                <p className='font-bold'>24 giờ 30 phút</p>
                            </div>
                            <div>
                                <button className='text-blue-400 cursor-pointer hover:text-blue-300 text-sm' onClick={handleExpandAll}>{expandedChapters.length === COURSE_DETAIL.chapters.length ? "Thu gọn tất cả":"Mở rộng tất cả"}</button>
                            </div>
                        </div>
                        <div className='flex flex-col gap-2'>
                            {COURSE_DETAIL.chapters.map((chapter)=>(
                                <div key={chapter.id} className='flex bg-[#1f2937] border border-gray-700 rounded-md flex-col'>
                                    <div onClick={()=> toggleChapter(chapter.id)} className='flex justify-between items-center p-3 md:p-4 hover:bg-gray-700 select-none'>
                                      <div className='flex items-center gap-3 cursor-pointer'>
                                        <div className='text-blue-400'>{expandedChapters.includes(chapter.id)?<Minus size={20}/>:<Plus size={20}/>}</div>
                                        <h3 className='text-sm md:text-base'>{chapter.title}</h3>
                                      </div>  
                                      <div className=''><span className='hidden sm:block text-sm text-gray-400 shrink-0 ml-2'>{chapter.lessons.length} Bài học</span></div>
                                    </div>

                                    {expandedChapters.includes(chapter.id) && (
                                  <div className='flex flex-col gap-1 border-t border-gray-700'>
                                    {chapter.lessons.map((lesson) =>(
                                      <div key={lesson.id} className='flex gap-3 cursor-pointer group justify-between border-b border-gray-700 p-2'>
                                        <div className='flex items-center gap-3'>
                                          <PlayCircle size={16} className='group-hover:text-green-500 text-gray-500 shrink-0'/>
                                          <span className='text-sm text-gray-400'>{lesson.title}</span>
                                        </div>
                                        <div>
                                          <span className='text-xs flex items-center text-gray-400 shrink-0'>{lesson.duration}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                </div>
                            ))}
                          </div>
                    </div>
                </div>
            </div>
            <div className='w-full lg:w-1/3'>
                <div className='flex flex-col gap-4 w-full justify-center items-center bg-[#1f2937] p-4 rounded-xl border border-gray-700 lg:sticky lg:top-4'>
                    <img src="https://files.fullstack.edu.vn/f8-prod/courses/1.png" alt="" className='w-90 rounded-xl'/>
                    <h1 className='text-3xl text-green-400'>MIỄN PHÍ</h1>
                    <button className='px-4 py-2 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-400'>ĐĂNG KÝ HỌC</button>
                    <div className='flex flex-col gap-2'>
                        <div className='flex gap-2'><CircleFadingArrowUp size={20}/><p>Trình độ cơ bản</p></div>
                        <div className='flex gap-2'><Film size={20}/><p>Tổng số 30 bài học</p></div>
                        <div className='flex gap-2'><Clock size={20}/><p>Thời lượng 29 giờ 13 phút</p></div>
                        <div className='flex gap-2'><BatteryFull size={20}/><p>Học mọi lúc, mọi nơi</p></div>
                    </div>
                </div>
            </div>
        </div>
    )
}