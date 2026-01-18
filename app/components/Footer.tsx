import { Code, Facebook, Github, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-300 py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          
          {/* CỘT 1: LOGO */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-white">
              <Code size={32} className="text-blue-500" />
              {/* 👇 ĐÃ SỬA TÊN WEB */}
              <span className="text-xl font-bold">DevSpace</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Nền tảng học lập trình trực tuyến chất lượng cao. Nơi khởi đầu đam mê và phát triển sự nghiệp công nghệ của bạn.
            </p>
          </div>

          {/* CỘT 2: TEAM INFO */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Đội ngũ phát triển</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-white font-medium">Nguyễn Hoàng Khang</span>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">Leader</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-white font-medium">Trần Bảo Khương</span>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">Backend</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-white font-medium">Đỗ Nguyễn Xiêu</span>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">Frontend</span>
              </li>
            </ul>
          </div>

          {/* CỘT 3: LIÊN HỆ */}
          <div>
             <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Liên hệ</h3>
             <div className="flex gap-4">
                <a href="#" className="hover:text-blue-500 transition-colors"><Facebook size={20}/></a>
                <a href="#" className="hover:text-white transition-colors"><Github size={20}/></a>
                <a href="#" className="hover:text-red-500 transition-colors"><Mail size={20}/></a>
             </div>
             <p className="mt-4 text-xs text-gray-500">
                Email: contact@devspace.vn<br/>
                Phone: 0987 654 321
             </p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-xs text-gray-600">
          <p>&copy; 2026 DevSpace. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}