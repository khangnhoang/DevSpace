import SidebarAdmin from "../components/SidebarAdmin";
import HeaderAdmin from "../components/HeaderAdmin";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // -----------------------------------------------------------
  // GIAO DIỆN CHÍNH (Khi đã qua cửa bảo vệ)
  // -----------------------------------------------------------
  return (
    <div className="h-full w-full bg-[#191C24]">
      {/* HEADER */}
      <div className="fixed top-0 left-0 w-full h-16 z-50 border-b border-gray-700 bg-[#191C24]">
        <HeaderAdmin />
      </div>

      {/* SIDEBAR */}
      <div className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 top-16 z-40 border-r border-gray-700">
        <SidebarAdmin isOpen={true} />
      </div>

      {/* MAIN CONTENT */}
      <main className="h-full pt-16 md:pl-56">
        <div className="h-full overflow-y-auto p-4 bg-[#0F1116]">
          {children}
        </div>
      </main>
    </div>
  );
}
