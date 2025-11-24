'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Import client cũ
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    // Gọi hàm đăng nhập của Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message); // Báo lỗi đơn giản
    } else {
      router.push('/'); // Thành công thì về trang chủ
      router.refresh(); // Refresh để cập nhật Header
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
     const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message); // Báo lỗi đơn giản
    } else {
      router.push('/'); // Thành công thì về trang chủ
      router.refresh(); // Refresh để cập nhật Header
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-green-600">Đăng nhập</h1>
        
        <input 
          className="w-full p-2 mb-4 border rounded placeholder-gray-500 text-gray-500" 
          placeholder="Email..." 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          className="w-full p-2 mb-4 border rounded placeholder-gray-500 text-gray-500" 
          type="password" 
          placeholder="Mật khẩu..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
        
        <button onClick={handleSignUp} className="mt-4 text-sm text-blue-600 w-full text-center cursor-pointer">
            Chưa có tài khoản? Đăng ký ngay
        </button>
      </div>
    </div>
  );
}