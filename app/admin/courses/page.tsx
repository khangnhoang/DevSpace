"use client";
import { useState } from "react";
import { SquarePen, X } from "lucide-react";
import Link from "next/link";

export default function CoursesPage() {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
    }
  };
  const handleClose = () => {
    setIsOpenForm(false);
    setSelectedImage(null);
  };

  return (
    <div>
      <div className="w-full p-4">
        <h1 className="font-bold text-2xl">Các khóa học phổ biến</h1>
        <div className="flex gap-4 py-4 px-2">
          <div className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4">
            <Link href="#">
              <img
                src="https://cdn.learn.codegym.vn/media/public/2021/08/13102217/html-va-css.jpeg"
                alt=""
                className="w-full h-40 rounded-t-xl"
              />
            </Link>
            <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 ">
              HTML&CSS cơ bản
            </p>
            <div className="flex justify-between p-3 w-full border-t border-gray-400">
              <p className="">20 bài học</p>
              <SquarePen
                size={20}
                className="cursor-pointer hover:opacity-80"
                onClick={() => setIsOpenForm(true)}
              />
            </div>
          </div>
          {isOpenForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-[#191C24] w-1/2 rounded-xl p-4 shadow-lg border-gray-700 relative flex flex-col">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-white mb-4">
                    Chỉnh sửa khóa học
                  </h1>
                  <div className="flex items-center gap-4">
                    <button className="bg-[#4A5565] p-1 rounded-md cursor-pointer hover:opacity-80">Lưu thay đổi</button>
                    <button
                      className=" text-gray-400 hover:text-white cursor-pointer"
                      onClick={handleClose}
                    >
                      <X size={24} />
                    </button>
                    
                  </div>
                </div>

                <div className="flex flex-col p-2 gap-2">
                  <p>Tên khóa học: </p>
                  <input type="text" className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none" />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Đường dẫn: </p>
                  <input type="text" className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none" />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Chú thích: </p>
                  <input type="text" className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none" />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Ảnh khóa học: </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="text-white border border-gray-500 rounded-md p-2 w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                  />
                  {selectedImage && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1">Xem trước:</p>
                      <img
                        src={selectedImage}
                        alt="Preview"
                        className="w-full h-40 rounded-md border border-gray-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
