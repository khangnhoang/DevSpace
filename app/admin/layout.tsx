import SidebarAdmin from "../components/SidebarAdmin";
import HeaderAdmin from "../components/HeaderAdmin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full">
      <HeaderAdmin/>
      <div className="mt-16 hidden md:flex h-full w-56 flex-col fixed inset-y-0 z-50">
         {/* Component Sidebar dành riêng cho Admin */}
         <SidebarAdmin/>
      </div>
      <main className="md:pl-56 h-full">
        {children}
      </main>
    </div>
  );
}