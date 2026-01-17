// app/components/Footer.tsx
import { Facebook, Github, Instagram, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-auto border-t border-gray-800">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">DevSpace</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            Nền tảng học lập trình thực chiến. Từ con số 0 đến Pro Developer với lộ trình bài bản.
          </p>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4">Khám phá</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-blue-400">Trang chủ</Link></li>
            <li><Link href="/courses" className="hover:text-blue-400">Khóa học</Link></li>
            <li><Link href="/blog" className="hover:text-blue-400">Bài viết</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4">Hỗ trợ</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="#" className="hover:text-blue-400">Điều khoản</Link></li>
            <li><Link href="#" className="hover:text-blue-400">Bảo mật</Link></li>
            <li><Link href="#" className="hover:text-blue-400">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4">Liên hệ</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><MapPin size={18}/> TP.HCM, Việt Nam</li>
            <li className="flex gap-2"><Phone size={18}/> 0123 456 789</li>
            <li className="flex gap-2"><Mail size={18}/> support@devspace.io</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}