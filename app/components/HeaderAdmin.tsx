"use client";
import { useState, useEffect, useRef } from "react";
import SidebarAdmin from "./SidebarAdmin";
import { TextAlignJustify, Bell, Home, CheckCheck } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CustomAvatar from "./CustomAvatar";

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

  // State cho User Info
  const [displayName, setDisplayName] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notiRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // 1. Lấy thông tin Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      let name = "Admin";
      if (profile?.full_name) {
        name = profile.full_name;
      } else if (user.email) {
        name = user.email.split("@")[0];
      }
      setDisplayName(name);
      setUserAvatar(profile?.avatar_url || null);

      // 2. Lấy thông báo (Top 10 cho thoải mái)
      const { data: notiData, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error) {
        setNotifications(notiData || []);
        setUnreadCount(notiData?.filter((n) => !n.is_read).length || 0);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setShowNotiDropdown(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Xử lý đọc 1 tin
  const handleReadNotification = async (notification: any) => {
    if (!notification.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      if (error) {
        console.error("Lỗi update noti:", error);
        return;
      }

      setNotifications((prev) =>
        prev.map((noti) =>
          noti.id === notification.id ? { ...noti, is_read: true } : noti
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setShowNotiDropdown(false);
  };

  // 👇 LOGIC MỚI: Đánh dấu tất cả đã đọc
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return; // Không có gì để đọc thì thôi

    // 1. Cập nhật UI ngay lập tức (Optimistic Update)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    // 2. Gọi API update ngầm bên dưới
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false); // Chỉ update những cái chưa đọc
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex justify-between bg-[#191C24] text-gray-400 h-16 items-center px-4 md:px-5 shadow-xl transition-all">
        {/* LOGO */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center text-white text-lg md:text-xl whitespace-nowrap font-bold"
          >
            DevSpace Admin
          </Link>
        </div>

        {/* MENU TOGGLE (Mobile) */}
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
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3 md:gap-6 text-white">
          {/* NOTIFICATION */}
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

              {showNotiDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-[#191C24] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                  <div className="p-3 border-b border-gray-700 font-semibold text-white flex justify-between items-center bg-[#222530]">
                    <span>Thông báo</span>
                    {/* 👇 Nút Đánh dấu tất cả đã đọc */}
                    <button
                      onClick={handleMarkAllRead}
                      disabled={unreadCount === 0}
                      className={`text-xs flex items-center gap-1 transition-colors ${
                        unreadCount > 0
                          ? "text-blue-400 hover:text-blue-300 cursor-pointer"
                          : "text-gray-500 cursor-default"
                      }`}
                    >
                      <CheckCheck size={14} />
                      Đánh dấu đã đọc
                    </button>
                  </div>

                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center gap-2 text-gray-500">
                        <Bell size={32} className="opacity-20" />
                        <span className="text-sm">Không có thông báo mới</span>
                      </div>
                    ) : (
                      notifications.map((noti) => (
                        <Link
                          key={noti.id}
                          href={noti.link || "#"}
                          onClick={() => handleReadNotification(noti)}
                          className={`block p-3 hover:bg-gray-800 transition-all border-b border-gray-800 last:border-0 ${
                            !noti.is_read ? "bg-[#2A303C]" : "bg-transparent"
                          }`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 transition-all ${
                                !noti.is_read
                                  ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                  : "bg-transparent"
                              }`}
                            ></div>
                            <div>
                              <p
                                className={`text-sm ${
                                  !noti.is_read
                                    ? "text-white font-semibold"
                                    : "text-gray-400"
                                }`}
                              >
                                {noti.title}
                              </p>
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                {noti.message}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1.5 font-medium">
                                {timeAgo(noti.created_at)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  {/* 👇 Đã XÓA nút "Xem tất cả" ở đây */}
                </div>
              )}
            </div>
          </div>

          {/* USER PROFILE */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 pl-2 md:border-l md:border-gray-700 cursor-pointer focus:outline-none"
            >
              <CustomAvatar
                src={userAvatar}
                className="h-8 w-8 md:h-10 md:w-10 border-2 border-transparent hover:border-green-400 transition-all"
              />
              <p className="text-sm font-medium hidden sm:block hover:text-green-400 transition-colors max-w-[150px] truncate">
                {displayName}
              </p>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-48 bg-[#191C24] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Home size={16} />
                  Về trang học tập
                </Link>
              </div>
            )}
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