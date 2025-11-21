import Link from "next/link"

export default function Header(){
    return (
        <header className="flex gap-4 bg-white text-black h-16">
            <div className="h-full flex">
                <Link href="/" className="p-4 text-blue-500 text-lg">W3schools Clone</Link>
                <Link href="/" className="hover:bg-blue-500 hover:text-white cursor-pointer p-4">HTML & CSS</Link>
            </div>
        </header>
    )
}