import Link from "next/link"

export default function NotFoundLesson(){
   
    return (
        <div className="flex justify-center items-center h-screen w-full flex-col bg-[#F8FAFC] gap-3 text-2xl">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                className="w-30 h-30 text-yellow-500" 
                >
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" 
                />
            </svg>
            <h1 className="text-black">KHÔNG TÌM THẤY</h1>
            <Link href="/" className="border rounded-xl p-2 px-8 text-black hover:bg-blue-500 hover:text-white">Quay về</Link>
        </div>
    )
}