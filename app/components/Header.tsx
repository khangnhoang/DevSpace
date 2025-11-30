'use client'; // 1. Thêm dòng này để dùng state
import { useEffect, useState } from 'react';
import Link from "next/link"
import { supabase } from '@/lib/supabase'; // 2. Import client Supabase
import { User } from '@supabase/supabase-js';

export default function Header(){
    // 3. State lưu thông tin user
    const [user, setUser] = useState<User | null>(null);

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

    // 5. Hàm đăng xuất
    const handleLogout = async () => {
        await supabase.auth.signOut();
        // setUser(null); // onAuthStateChange sẽ tự bắt sự kiện này nên ko cần set tay cũng được
        window.location.reload(); // Reload trang cho sạch sẽ
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