import Link from "next/link"
export default function Sidebar(){
    return (
        <aside className="flex flex-col px-8 py-4 gap-3 w-1/4">
            <Link href="#" className="hover:bg-gray-500">Giới Thiệu HTML</Link>
            <Link href="#" className="hover:bg-gray-500">Các thẻ cơ bản</Link>
        </aside>
    )
}