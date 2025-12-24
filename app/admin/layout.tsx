import SidebarAdmin from "../components/SidebarAdmin";
import HeaderAdmin from "../components/HeaderAdmin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full bg-[#191C24]"> {/* Thêm màu nền tối để đồng bộ */}
      
      {/* 1. HEADER: Cố định tuyệt đối trên cùng (z-50 cao nhất) */}
      <div className="fixed top-0 left-0 w-full h-16 z-50 border-b border-gray-700 bg-[#191C24]">
        <HeaderAdmin/>
      </div>

      {/* 2. SIDEBAR: Cố định bên trái, bắt đầu từ top-16 (dưới header) */}
      {/* Thay mt-16 bằng top-16 để căn chuẩn vị trí viewport */}
      <div className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 top-16 z-40 border-r border-gray-700">
         <SidebarAdmin isOpen={true}/>
      </div>

      {/* 3. MAIN CONTENT: Đẩy nội dung xuống và sang phải để không bị che */}
      {/* pt-16: Tránh header che */}
      {/* md:pl-56: Tránh sidebar che */}
      <main className="h-full pt-16 md:pl-56">
        <div className="h-full overflow-y-auto p-4"> {/* Cho phép cuộn nội dung riêng */}
           {children}
        </div>
      </main>
      
    </div>
  );
}