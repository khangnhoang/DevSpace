"use client";
import { useState, useEffect, useRef } from "react";
import SidebarAdmin from "./SidebarAdmin";
import { TextAlignJustify, Bell, Plus } from "lucide-react";
import Link from "next/link";
import { markAsRead } from "../action/get-notifications";
import { supabase } from "@/lib/supabase";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function HeaderAdmin() {
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [showNotiDropdown, setShowNotiDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log("Chưa đăng nhập ở client");
        return;
      }

      // Query trực tiếp DB
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("receiver_id", user.id) // Lấy đúng của mình
        .order("created_at", { ascending: false })
        .limit(5); // Lấy 5 cái

      if (error) {
        console.error("Lỗi fetch noti:", error);
      } else {
        setNotifications(data || []);
        setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
      }
    };

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setShowNotiDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleReadNotification = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((noti) =>
          noti.id === notification.id ? { ...noti, is_read: true } : noti
        )
      );
      setUnreadCount((prev) => prev - 1);
    }
    setShowNotiDropdown(false);
  };
  return (
    <>
      <header className="sticky top-0 z-50 flex justify-between bg-[#191C24] text-gray-400 h-16 items-center px-4 md:px-5 shadow-xl transition-all">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center text-white text-lg md:text-xl whitespace-nowrap"
          >
            DevSpace Admin
          </Link>
        </div>

        <div className="flex md:gap-8 gap-4 flex-1 mr-4 justify-end items-center md:justify-start md:ml-10 md:mr-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden hover:text-white transition-colors focus:outline-none p-1 rounded hover:bg-gray-800"
          >
            <TextAlignJustify
              size={14}
              className={isSidebarOpen ? "text-blue-500" : ""}
            />
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
              <Plus size={14} />
              <span className="hidden lg:inline font-medium">
                Tạo khóa học mới
              </span>
            </button>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <div className="relative" ref={notiRef}>
              <button
                onClick={() => setShowNotiDropdown(!showNotiDropdown)}
                className="hover:text-green-400 transition-colors relative cursor-pointer"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN UI */}
              {showNotiDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-[#191C24] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                  <div className="p-3 border-b border-gray-700 font-semibold text-white flex justify-between items-center">
                    <span>Thông báo</span>
                    <span className="text-xs text-gray-400 cursor-pointer hover:text-white">
                      Đánh dấu tất cả đã đọc
                    </span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Không có thông báo mới
                      </div>
                    ) : (
                      notifications.map((noti) => (
                        <Link
                          key={noti.id}
                          href={noti.link || "#"}
                          onClick={() => handleReadNotification(noti)}
                          className={`block p-3 hover:bg-gray-800 transition-colors border-b border-gray-800 ${
                            !noti.is_read ? "bg-gray-800/30" : ""
                          }`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                !noti.is_read
                                  ? "bg-green-500"
                                  : "bg-transparent"
                              }`}
                            ></div>
                            <div>
                              <p
                                className={`text-sm ${
                                  !noti.is_read
                                    ? "text-white font-medium"
                                    : "text-gray-400"
                                }`}
                              >
                                {noti.title}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                {noti.message}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                {timeAgo(noti.created_at)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-700 text-center">
                    <Link
                      href="/admin/notifications"
                      className="text-xs text-green-400 hover:text-green-300"
                    >
                      Xem tất cả
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <Link
              href="#"
              className="flex items-center gap-3 pl-2 md:border-l md:border-gray-700"
            >
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
