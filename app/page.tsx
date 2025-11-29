"use client"
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link"


export default function Home() {
  return (
    <div className="bg-white h-screen w-screen p-2 text-black flex flex-col gap-4">
      <h1 className="text-4xl">Khóa học:</h1>
      <div className="flex flex-row gap-4">
          <div className="w-1/3 bg-gray-200 flex flex-col rounded-xl hover:shadow-xl">
            <img src="https://files.fullstack.edu.vn/f8-prod/courses/2.png" alt="" className="rounded-t-xl"/>
            <div className="flex flex-col gap-2 p-4 text-xl">
              <span>HTML & CSS Từ Zero đến Hero</span>
              <div className="flex justify-between">
                <span>Miễn phí</span>
                <Link href="#"><button className="rounded-full px-2 bg-blue-400 text-white cursor-pointer hover:opacity-50">Học ngay</button></Link>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
