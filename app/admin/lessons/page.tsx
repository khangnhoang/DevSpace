"use client";
import { Pencil, Trash2, ExternalLink, SquarePen, Trash } from "lucide-react";
import { title } from "process";

export default function LessonsManagerPage(){
    const mockLessons = [
        {
            id: 1,
            title: "Giới thiệu HTML",
            course: "HTML & CSS Cơ bản",
            chapter: "Chương 1: Nhập môn",
        },
    ]
    return(
        <div className="p-4">
            <div className="flex justify-between p-2">
                <h1>Quản lí bài học</h1>
                <button className="bg-green-500 rounded-md p-2 hover:opacity-80 cursor-pointer">Thêm bài học mới</button>
            </div>
            <table className="w-3/4">
                <thead className="bg-gray-700">
                    <tr>
                        <th scope="col" className="px-6 py-3">Tên bài học</th>
                        <th scope="col" className="px-6 py-3">Tên khóa học</th>
                        <th scope="col" className="px-6 py-3">Chương bài học</th>
                        <th scope="col" className="px-6 py-3">Hành động: Sửa/Xóa</th>
                    </tr>
                </thead>
                <tbody className="">
                    {mockLessons.map((lessons) => (
                        <tr key={lessons.id} className="bg-[#191C24] border-b border-gray-700 hover:bg-gray-800 transition-colors ">
                            <td scope="row" className=" font-medium text-white whitespace-nowrap">
                                {lessons.title}
                            </td>
                            <td className="">
                                {lessons.course}
                            </td>
                            <td className="">
                                {lessons.chapter}
                            </td>
                            <td className="flex py-4 w-full justify-center gap-2">
                                <SquarePen size={20}/>
                                <Trash size={20}/>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}