"use client";
import { useState, useEffect } from "react";
import { SquarePen, Trash, X } from "lucide-react";

export default function LessonsManagerPage(){
    const mockLessons = [
        {
            id: 1,
            title: "Giới thiệu HTML",
            course: "HTML & CSS Cơ bản",
            chapter: "Chương 1: Nhập môn",
        },
    ]
    const [isOpenForm, setIsOpenForm] = useState(false)
    const handleOpenAddForm = () => {
        setIsOpenForm(true)
    }
    return(
        <div className="p-4">
            <div className="flex justify-between p-2">
                <h1>Quản lí bài học</h1>
                <button className="bg-green-500 rounded-md p-2 hover:opacity-80 cursor-pointer" onClick={handleOpenAddForm}>Thêm bài học mới</button>
            </div>
            {isOpenForm && (
                <div className="flex fixed inset-0 z-50 items-center justify-center p-2">
                    <div className="w-4/5 flex">
                        <div className="w-1/3 bg-[#364153] p-2 rounded-l-md flex flex-col gap-2">
                            <div className="flex flex-col">
                                <label className="font-bold">Tên bài</label>
                                <input type="text" name="" id="" className="bg-gray-600 rounded-md"/>
                            </div>
                            <div className="flex ">
                                <label htmlFor="" className="font-bold">Khóa học</label>
                                <select name="" id=""></select>
                            </div>
                            <div className="flex ">
                                <label htmlFor="" className="font-bold">Chương</label>
                                <select name="" id=""></select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="" className="font-bold">Đường dẫn</label>
                                <input type="text" name="" id="" className="bg-gray-600 rounded-md"/>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="" className="font-bold">Đường dẫn video</label>
                                <input type="text" name="" id="" className="bg-gray-600 rounded-md"/>
                            </div>
                        </div>
                        <div className="w-2/3 bg-[#364153] p-2 rounded-r-md flex flex-col gap-2">
                            <div className="flex justify-between">
                                <p className="font-bold">Viết Content MDX </p>
                                <X className= "cursor-pointer" scale={20} onClick={() =>
                                    setIsOpenForm(false)
                                }/>
                            </div>
                            
                            <textarea className="w-full h-50 border rounded-md"></textarea>
                        </div>
                    </div>
                </div>
            )}
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
                        <tr key={lessons.id} className="bg-[#191C24] border-b border-gray-700 hover:bg-gray-800 transition-colors">
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
                                <button className="cursor-pointer"><SquarePen size={20}/></button>
                                <button className="cursor-pointer"><Trash size={20}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}