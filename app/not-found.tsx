import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#191C24] text-white px-4">
      <h1 className="text-9xl font-extrabold text-gray-700 tracking-widest">404</h1>
      <div className="bg-[#FF6A3D] px-2 text-sm rounded rotate-12 absolute">
        Page Not Found
      </div>
      <div className="mt-8 text-center">
        <h3 className="text-2xl md:text-3xl font-semibold mb-2">
          Lạc đường rồi bạn ơi!
        </h3>
        <p className="text-gray-400 mb-8">
          Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        
        <Link 
          href="/"
          className="relative inline-block text-sm font-medium text-[#FF6A3D] group active:text-orange-500 focus:outline-none focus:ring"
        >
          <span className="absolute inset-0 transition-transform translate-x-0.5 translate-y-0.5 bg-[#FF6A3D] group-hover:translate-y-0 group-hover:translate-x-0"></span>

          <span className="relative block px-8 py-3 bg-[#1A2238] border border-current text-green-400 hover:text-green-300">
            Về Trang Chủ
          </span>
        </Link>
      </div>
    </div>
  )
}