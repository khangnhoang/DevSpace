// app/components/Header.tsx (hoặc đường dẫn thực tế của ông)
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase, searchLesson } from "@/lib/supabase";
import { Search, Loader2, FileText, X, Menu, LogOut, User as UserIcon, Shield } from "lucide-react";
import { User } from "@supabase/supabase-js";
import CustomAvatar from "./CustomAvatar"; // Nhớ import cái vừa tạo

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  // Thêm state lưu role và avatar từ bảng profiles
  const [userRole, setUserRole] = useState<string>("user"); 
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false); // Menu dropdown của user
  
  // State lưu danh sách khóa học để render menu
  const [courses, setCourses] = useState<{id: number, name: string, slug: string}[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Fetch danh sách khóa học để render Header Link
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, name, slug")
        .order("id", { ascending: true });
      
      if (data) setCourses(data);
    };
    fetchCourses();
  }, []);

  // 2. Logic User & Role
  useEffect(() => {
    const getUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // Lấy thêm Role và Avatar từ bảng profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, avatar_url")
          .eq("id", currentUser.id)
          .single();
        
        if (profile) {
          setUserRole(profile.role);
          setUserAvatar(profile.avatar_url);
        }
      }
    };

    getUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      // Nếu logout thì reset role
      if (!session) {
        setUserRole("user");
        setUserAvatar(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Logic Search (Giữ nguyên của ông)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 1) {
        setLoading(true);
        const data = await searchLesson(query);
        setResults(data || []);
        setLoading(false);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside (Gộp cả Search và User Menu)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="relative flex bg-white text-black h-16 items-center md:pr-4 shadow-sm border-b border-gray-200 px-2 md:px-4 z-50 min-w-full">
      <div className="h-full flex items-center">
        <button className="p-2 mr-2 lg:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <Link href="/" className="p-2 md:p-4 text-blue-600 text-xl font-extrabold tracking-tight whitespace-nowrap">
          DevSpace
        </Link>

        {/* --- DYNAMIC MENU (Render từ DB) --- */}
        <div className="hidden lg:flex h-full items-center gap-1">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/course/${course.slug}`} // Sửa lại link cho đúng logic của ông
              className="hover:bg-blue-50 text-gray-600 hover:text-blue-600 font-medium px-3 lg:px-4 py-2 rounded-md transition-colors text-sm lg:text-base uppercase whitespace-nowrap"
            >
              {course.name}
            </Link>
          ))}
          <Link
            href="/try_it"
            className="hover:bg-blue-50 text-gray-600 hover:text-blue-600 font-medium px-3 lg:px-4 py-2 rounded-md transition-colors text-sm lg:text-base uppercase whitespace-nowrap"
          >
            TRY IT YOURSELF
          </Link>
        </div>
      </div>

      {/* --- SEARCH BAR --- */}
      <div ref={searchRef} className="flex-1 min-w-0 md:max-w-md mx-4 relative max-w-xs hidden md:block">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" />
          </div>
          <input
            type="text"
            className="duration-300 block w-full pl-9 pr-8 py-2 text-sm text-gray-900 border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
            placeholder="Tìm bài học..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          />
          {loading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            </div>
          )}
        </div>
        {/* Kết quả Search (Giữ nguyên logic của ông) */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-lg shadow-xl overflow-hidden z-50">
            {results.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/learn/${lesson.courses.slug}/${lesson.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none cursor-pointer"
                onClick={() => { setShowDropdown(false); setQuery(""); }}
              >
                <div className="bg-blue-100 p-2 rounded-md"><FileText size={16} className="text-blue-600" /></div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{lesson.title}</div>
                  <div className="text-xs text-gray-500">Khóa: {lesson.courses?.name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* --- USER MENU (DROPDOWN) --- */}
      <div className="ml-auto flex items-center gap-4">
        {user ? (
          <div className="relative" ref={userMenuRef}>
            {/* Nút Avatar với hiệu ứng Focus mượt */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="cursor-pointer hover:scale-105 hover:ring hover:shadow rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <CustomAvatar src={userAvatar} className="w-9 h-9 sm:w-10 sm:h-10" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                {/* Header Dropdown */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                {/* Nút Admin (Chỉ hiện nếu là Admin) */}
                {userRole === "admin" && (
                  <Link
                    href="/admin/courses"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Shield size={16} />
                    Trang quản trị
                  </Link>
                )}

                {/* Nút Profile */}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <UserIcon size={16} />
                  Hồ sơ cá nhân
                </Link>

                <div className="h-px bg-gray-100 my-1"></div>

                {/* Nút Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all font-semibold shadow-lg shadow-blue-500/30 text-sm sm:text-base"
          >
            Đăng nhập
          </Link>
        )}
      </div>
      
      {/* Mobile Menu (Cập nhật sơ qua cho đồng bộ) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 w-full bg-white border-t border-gray-200 shadow-xl flex flex-col text-gray-800 animate-in slide-in-from-top-5">
           {courses.map((course) => (
             <Link key={course.id} href={`/learn/${course.slug}`} className="p-4 border-b border-gray-100 hover:bg-gray-50 font-medium uppercase">
               {course.name}
             </Link>
           ))}
           {/* ... Mobile logic ... */}
        </div>
      )}
    </header>
  );
}