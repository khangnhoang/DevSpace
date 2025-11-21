import Link from "next/link"
export default function Sidebar(){
    return (
        <aside className="flex px-2 py-4 gap-3 w-1/4 bg-slate-50 min-h-screen">
            <div className="flex flex-col bg-gray-500 w-full rounded-xl">
                <h1 className="p-4 text-2xl text-black">HTML & CSS</h1>
                <Link href="#" className="hover:bg-blue-500 text-black hover:text-white p-3 rounded-t-xl">GIỚI THIỆU HTML</Link>
                <Link href="#" className="hover:bg-blue-500 text-black hover:text-white p-3">CÁC THẺ CƠ BẢN</Link>
            </div>
        </aside>
    )
}