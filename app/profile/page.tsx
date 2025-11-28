'use client'
import { useState } from "react"
import ProgressBar from "./PropressBar"

export default function ProfilePage(){

    return (
        <div className="bg-[#F9FAFB] h-screen w-screen flex">
            <div className="m-3 w-1/4 flex flex-col items-center gap-2 bg-[#6A7282] p-4 rounded-md">
                <img src="/correct-incorrect-vector.jpg" alt="Avatar" className="w-40 h-40 rounded-full" />
                <p className="text-2xl font-bold">Nguyễn Văn Nam</p>
                <p>nambede@gmail.com</p>
            </div>
            <div className="m-3 w-3/4 flex flex-col gap-2 p-4 text-black bg-gray-200 rounded-xl">
                <h1 className="text-5xl">Lập Trình JavaScript Cơ Bản</h1>
                <p>Học Javascript cơ bản phù hợp cho người chưa từng học lập trình. Với hơn 100 bài học và có bài tập thực hành sau mỗi bài học.</p>
                <h2 className="text-4xl">Bạn sẽ học được gì?</h2>
                <p>Hiểu chi tiết về các khái niệm cơ bản trong JS</p>
                <p className="w-90"><ProgressBar percent={31}/></p>
            </div>
        </div>
    )
}