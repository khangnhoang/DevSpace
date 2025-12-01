'use client'; 
import { useEffect, useState, useRef } from 'react'; // 1. Thêm useRef
import Link from "next/link";
import { supabase, searchLesson } from '@/lib/supabase'; // 2. Import hàm search
import { User } from '@supabase/supabase-js';
import { Search, Loader2, FileText } from "lucide-react"; // 3. Import Icon

export default function Header(){
    // 3. State lưu thông tin user
    const [user, setUser] = useState<User | null>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // 4. Logic kiểm tra đăng nhập (Chạy 1 lần khi load trang)
    useEffect(() => {
        // Lấy session hiện tại
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user || null);
        };
        getUser();

        // Lắng nghe sự kiện (Đăng nhập/Đăng xuất) để cập nhật UI ngay lập tức
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);
// --- LOGIC SEARCH (MỚI THÊM) ---
    useEffect(() => {
        // Debounce: Đợi 500ms sau khi ngừng gõ mới tìm
        const timer = setTimeout(async () => {
            if (query.trim().length > 1) {
                setLoading(true);
                const data = await searchLesson(query);
                console.log("Kết quả tìm kiếm:", data);
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

    // Click ra ngoài để đóng bảng tìm kiếm
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
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
        <header className="flex gap-4 bg-white text-black h-16 items-center pr-4 shadow-xl">
            {/* --- PHẦN GIAO DIỆN CŨ CỦA BẠN (GIỮ NGUYÊN) --- */}
            <div className="h-full flex items-center">
                <Link href="/" className="p-4 text-blue-500 text-lg font-bold">W3schools Clone</Link>
                <Link href="/learn/html-css/html-intro" className="hover:bg-blue-500 hover:text-white cursor-pointer p-4 h-full flex items-center transition-colors">HTML & CSS</Link>
                <Link href="/quiz/html-intro" className="hover:bg-blue-500 hover:text-white cursor-pointer p-4 h-full flex items-center transition-colors">BÀI TẬP</Link>
                <Link href="/try_it" className="hover:bg-blue-500 hover:text-white cursor-pointer p-4 h-full flex items-center transition-colors">TRY IT YOURSELF</Link>
            </div>

            {/* --- SEARCH BAR (CHÈN VÀO GIỮA) --- */}
            <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-8 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-full bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Tìm kiếm..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => { if(results.length > 0) setShowDropdown(true) }}
                    />
                    {loading && (
                        <div className="absolute inset-y-0 right-3 flex items-center">
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        </div>
                    )}
                </div>

                {/* Dropdown Kết quả */}
                {showDropdown && results.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden z-50">
                        {results.map((lesson) => (
                            <Link
                                key={lesson.id}
                                href={`/learn/${lesson.courses.slug}/${lesson.slug}`}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-blue-50 border-b last:border-none cursor-pointer"
                                onClick={() => {
                                    setShowDropdown(false);
                                    setQuery("");
                                }}
                            >
                                <FileText size={14} className="text-blue-600" />
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{lesson.title}</div>
                                    <div className="text-xs text-gray-500">Khóa: {lesson.courses?.name}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
                
                {/* Thông báo không tìm thấy */}
                {showDropdown && !loading && query.length > 1 && results.length === 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
                        Không tìm thấy bài học nào.
                    </div>
                )}
            </div>

            {/* --- PHẦN AUTH MỚI THÊM VÀO (Tự đẩy sang phải nhờ ml-auto) --- */}
            <div className="ml-auto">
                {user ? (
                    // Trạng thái ĐÃ ĐĂNG NHẬP
                    <div className="flex gap-3 items-center">
                        <Link href={`/profile`} className="text-lg font-medium cursor-pointer"> {"xin chào "}
                            {user.email?.split('@')[0]} {/* Hiện tên email */}
                        </Link>
                        <button 
                            onClick={handleLogout}
                            className="text-lg text-blue-500 hover:opacity-70 font-bold cursor-pointer"
                        >
                            Đăng xuất
                        </button>
                    </div>
                ) : (
                    // Trạng thái CHƯA ĐĂNG NHẬP
                    <Link 
                        href="/login" 
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-bold text-lg"
                    >
                        Đăng nhập
                    </Link>
                )}
            </div>
        </header>
    )
}