import Link from "next/link"
import { Play} from 'lucide-react';

export default function TryItPage(){
    return(
        <div className="h-screen w-screen flex flex-col">
            <header className="h-14 bg-gray-400 border-b border-gray-200 flex items-center justify-center">
                <Link href="#" className="border bg-blue-500 text-2xl rounded-sm px-4 flex flex-row items-center">Run<Play size={16} fill="currentColor" /></Link>
            </header>
            <div className="flex flex-row text-black relative h-full">
                <div className="bg-gray-200 w-1/2 border-r flex flex-col">
                    <textarea placeholder="Viết code vào đây" className="bg-transparent w-full h-full resize-none focus:ring-0 border-none outline-none focus:border-transparent"/>
                </div>
                <div className="bg-gray-200 w-1/2 flex flex-col">
                    <iframe title="result"/>
                </div>
            </div>
        </div>
    )
}