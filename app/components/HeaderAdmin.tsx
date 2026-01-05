"use client";
import React, { useState } from 'react';
import SidebarAdmin from './SidebarAdmin';
import { TextAlignJustify, LayoutGrid, Mail, Bell, Plus } from "lucide-react";
import Link from "next/link";

export default function HeaderAdmin() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  return (
    <>
    <header className="sticky top-0 z-50 flex justify-between bg-[#191C24] text-gray-400 h-16 items-center px-4 md:px-5 shadow-xl transition-all">
      <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center text-white text-lg md:text-xl whitespace-nowrap">DevSpace Admin</Link>
      </div>
      
      <div className="flex md:gap-8 gap-4 flex-1 mr-4 justify-end items-center md:justify-start md:ml-10 md:mr-4">
        <button onClick={toggleSidebar} className="md:hidden hover:text-white transition-colors focus:outline-none p-1 rounded hover:bg-gray-800">
          <TextAlignJustify size={14} className={isSidebarOpen?"text-blue-500":""}/>
        </button>
        
        <div className="hidden md:block w-full max-w-md relative">
          <input
          type="text"
          placeholder="Tìm kiếm"
          className="border w-full p-2 rounded-md focus:outline-none border-[#676D8C] py-1.5 px-4 focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all text-sm"
          />
        </div>
        
      </div>
      <div className="flex items-center gap-3 md:gap-6 text-white">
        <Link href="#">
          <button className="flex items-center gap-2 cursor-pointer bg-green-600/20 hover:bg-green-500 hover:text-white text-green-400 border border-green-600/50 p-2 rounded-md text-sm transition-all">
            <Plus size={14} /><span className="hidden lg:inline font-medium">Tạo khóa học mới</span>
          </button>
        </Link>

        <div className="hidden md:flex items-center gap-5">
        <Link href="#" className="hover:text-green-400 transition-colors">
          <LayoutGrid size={20} />
        </Link>
        <Link href="#" className="hover:text-green-400 transition-colors">
          <Mail size={20} />
        </Link>
        <Link href="#" className="hover:text-green-400 transition-colors">
          <Bell size={20} />
        </Link>
        </div>
        <div>
          <Link href="#" className="flex items-center gap-3 pl-2 md:border-l md:border-gray-700">
            <img
              src="https://weart.vn/wp-content/uploads/2025/06/anh-avatar-vo-tri-don-gian-dang-yeu.jpg"
              alt=""
              className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border-2 border-transparent hover:border-green-400 transition-all"
            />
            <p className="text-sm font-medium hidden sm:block">Helen</p>
          </Link>
        </div>
      </div>
    </header>
    <SidebarAdmin isOpen={isSidebarOpen} />
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
    </>
  );
}
