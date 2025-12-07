import { TextAlignJustify, LayoutGrid, Mail, Bell, Plus } from "lucide-react";
import Link from "next/link";
export default function HeaderAdmin() {
  return (
    <header className="flex justify-between bg-[#191C24] text-gray-400 h-16 items-center p-5 shadow-xl">
      <h1 className="flex items-center text-white text-xl">W3Schools Clone</h1>
      <div className="flex gap-8 w-1/3 items-center">
        <Link href="#">
          <TextAlignJustify size={14} />
        </Link>
        <input
          type="text"
          placeholder="Tìm kiếm"
          className="border w-full p-2 rounded-md focus:outline-none border-[#676D8C]"
        />
      </div>
      <div className="flex items-center gap-8 text-white">
        <Link href="#">
          <button className="flex items-center cursor-pointer hover:bg-green-400 p-2 rounded-md text-sm">
            <Plus size={14} />
            Tạo khóa học mới
          </button>
        </Link>
        <Link href="#">
          <LayoutGrid size={20} />
        </Link>
        <Link href="#">
          <Mail size={20} />
        </Link>
        <Link href="#">
          <Bell size={20} />
        </Link>
        <div>
          <Link href="#" className="flex items-center gap-2">
            <img
              src="https://weart.vn/wp-content/uploads/2025/06/anh-avatar-vo-tri-don-gian-dang-yeu.jpg"
              alt=""
              className="h-10 w-10 rounded-full"
            />
            <p className="text-sm">Helen</p>
          </Link>
        </div>
      </div>
    </header>
  );
}
