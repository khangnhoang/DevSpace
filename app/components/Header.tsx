"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, searchLesson } from "@/lib/supabase";
import {
  Search,
  Loader2,
  FileText,
  LogOut,
  User as UserIcon,
  Shield,
  Code2,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import CustomAvatar from "./CustomAvatar";

interface SearchResult {
  id: number;
  slug: string;
  name: string;
  image_url?: string | null;
  price: number;
}

export default function Header() {
  const router = useRouter();

  // --- STATE & REF ---
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // =========================
  // 1. LOGIC AUTH + PROFILE
  // =========================
  useEffect(() => {
    let isMounted = true;

    const fetchUserProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;

      if (data && !error) {
        setUserRole(data.role || "user");
        setUserAvatar(data.avatar_url || null);
      }
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setUserRole("user");
        setUserAvatar(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =========================
  // 2. LOGIC SEARCH
  // =========================
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length <= 1) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      try {
        setLoading(true);
        const data = await searchLesson(query);
        setResults(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // =========================
  // 3. CLICK OUTSIDE
  // =========================
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
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

  // =========================
  // 4. LOGOUT
  // =========================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // =========================
  // 5. RENDER UI
  // =========================
  return (
    <header className="relative flex bg-white text-black h-16 items-center justify-between md:pr-4 shadow-sm border-b border-gray-200 px-4 z-50 min-w-full">
      {/* --- LEFT: LOGO --- */}
      <div className="flex items-center z-10">
        {/* Đã xóa nút Menu Mobile ở đây */}
        <Link
          href="/"
          className="flex items-center gap-2 py-1 group"
        >
          {/* Logo Icon giả lập */}
          <div className="bg-blue-600 text-white p-1.5 md:p-2 rounded-lg shadow-sm group-hover:bg-blue-700 transition-colors duration-300">
            <Code2 size={20} strokeWidth={2.5} className="md:w-6 md:h-6" />
          </div>

          {/* Tên Web */}
          <span className="text-xl md:text-2xl font-extrabold tracking-tight text-blue-600 group-hover:text-blue-700 transition-colors duration-300">
            DevSpace
          </span>
        </Link>
      </div>

      {/* --- CENTER: SEARCH BAR --- */}
      <div
        ref={searchRef}
        className="hidden md:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4"
      >
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" />
          </div>
          <input
            type="text"
            className="duration-300 block w-full pl-9 pr-8 py-2 text-sm text-gray-900 border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
            placeholder="Tìm khóa học..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
          />
          {loading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Kết quả Search */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-lg shadow-xl max-h-65 overflow-y-auto z-50">
            {results.map((course) => (
              <Link
                key={course.id}
                href={`/course/${course.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none cursor-pointer"
                onClick={() => {
                  setShowDropdown(false);
                  setQuery("");
                }}
              >
                <div className="relative w-14 h-9 shrink-0 rounded overflow-hidden border border-gray-200 bg-gray-100">
                  {course.image_url ? (
                    <>
                      <img
                        src={course.image_url}
                        alt={course.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden"
                          );
                        }}
                      />
                      <div className="hidden w-full h-full flex items-center justify-center bg-blue-50">
                        <FileText size={16} className="text-blue-500" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50">
                      <FileText size={16} className="text-blue-500" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800 uppercase">
                    {course.name}
                  </div>
                  <div className="text-xs text-gray-500 uppercase">
                    Giá: {formatCurrency(course.price)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* --- RIGHT: USER MENU --- */}
      <div className="flex items-center gap-4 z-10 bg-white pl-2">
        {user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="cursor-pointer hover:scale-105 hover:ring hover:shadow rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <CustomAvatar
                src={userAvatar}
                className="w-9 h-9 sm:w-10 sm:h-10"
              />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                {userRole === "admin" && (
                  <Link
                    onClick={() => setShowUserMenu(false)}
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Shield size={16} />
                    Trang quản trị
                  </Link>
                )}

                <Link
                  onClick={() => setShowUserMenu(false)}
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <UserIcon size={16} />
                  Hồ sơ cá nhân
                </Link>

                <div className="h-px bg-gray-100 my-1"></div>

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

      {/* Đã xóa khối render mobile menu ở cuối */}
    </header>
  );
}