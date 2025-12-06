import { SquarePen  } from "lucide-react";

export default function CoursesPage(){
    return(
        <div>
            <div className="w-full p-4">
                <h1 className="font-bold text-2xl">Các khóa học phổ biến</h1>
                <div className="flex gap-4 py-4 px-2">
                    <div className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4">
                        <img src="https://cdn.learn.codegym.vn/media/public/2021/08/13102217/html-va-css.jpeg" alt="" className="w-full h-40 rounded-t-xl"/>
                        <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 ">HTML&CSS cơ bản</p>
                        <div className="flex justify-between p-3 w-full border-t border-gray-400">
                            <p className="">20 bài học</p>
                            <SquarePen size={20} className="cursor-pointer hover:opacity-80"/>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4">
                        <img src="https://cdn.learn.codegym.vn/media/public/2021/08/13102217/html-va-css.jpeg" alt="" className="w-full h-40 rounded-t-xl"/>
                        <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 ">HTML&CSS cơ bản</p>
                        <div className="flex justify-between p-3 w-full border-t border-gray-400">
                            <p className="">20 bài học</p>
                            <SquarePen size={20} className="cursor-pointer hover:opacity-80"/>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4">
                        <img src="https://cdn.learn.codegym.vn/media/public/2021/08/13102217/html-va-css.jpeg" alt="" className="w-full h-40 rounded-t-xl"/>
                        <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 ">HTML&CSS cơ bản</p>
                        <div className="flex justify-between p-3 w-full border-t border-gray-400">
                            <p className="">20 bài học</p>
                            <SquarePen size={20} className="cursor-pointer hover:opacity-80"/>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4">
                        <img src="https://cdn.learn.codegym.vn/media/public/2021/08/13102217/html-va-css.jpeg" alt="" className="w-full h-40 rounded-t-xl"/>
                        <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 ">HTML&CSS cơ bản</p>
                        <div className="flex justify-between p-3 w-full border-t border-gray-400">
                            <p className="">20 bài học</p>
                            <SquarePen size={20} className="cursor-pointer hover:opacity-80"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}