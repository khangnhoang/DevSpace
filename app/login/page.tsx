'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Import client cũ
import { useRouter } from 'next/navigation';

type ViewState = 'login' | 'register'
type AuthMessage = {
  text: string,
  type: 'error' | 'success'
}



export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [view, setView] = useState<ViewState>('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<AuthMessage | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    // Gọi hàm đăng nhập của Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({text:'Sai email hoặc mật khẩu', type:'error'}); // Báo lỗi đơn giản
    } else {
      setMessage({text:'Đăng nhập thành công', type:'success'});
      router.refresh(); // Refresh để cập nhật Header
      setTimeout(() => {
      router.push('/'); // Thành công thì về trang chủ
      }, 3000)
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
      setMessage({text:'Email hoặc mật khẩu không hợp lệ', type:'error'});
    } else {
      setMessage({text:'Đăng ký thành công', type:'success'});
      router.refresh(); // Refresh để cập nhật Header
      setTimeout(() => {
      router.push('/'); // Thành công thì về trang chủ
      }, 3000)
    }
    setLoading(false);
  };

  const changeUI = () => {
    setView(view==='register'?'login':'register')
  }

  const handleAuthentication = async () => {
    if (view==='register'){
      if (password !== confirmPassword) {
      setMessage({text:'Mật khẩu không trùng khớp', type:'error'});
      return
      }   
      handleSignUp()
    } else
      handleLogin()

  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full">
      <form onSubmit={handleAuthentication} className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-green-600">{view==='login'?'Đăng nhập':'Đăng ký'}</h1>
        
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
        <input 
          className={`w-full p-2 mb-4 border rounded placeholder-gray-500 text-gray-500 ${view==='register'?'block':'hidden'}`}
          type="password" 
          placeholder="Xác nhận Mật khẩu..."
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {message && (<div className={`${message.type==='error'?'text-red-500':'text-green-500'}`}>{message.text}</div>)}
        <button 
          onClick={handleAuthentication}
          disabled={loading}
          className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50"
          type='button'
        >
          {view==='login'?'Đăng nhập':'Đăng ký'}
        </button>
        
        <button className="mt-4 text-sm text-blue-600 w-full text-center cursor-pointer" onClick={changeUI} type='button'>
            {view==='register'?'Đã có tài khoản? Đăng nhập': 'Chưa có tài khoản? Đăng ký'}
        </button>
      </form>
    </div>
  );
}