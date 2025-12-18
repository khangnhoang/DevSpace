import { Check } from 'lucide-react';

export default function DetailPage(){
    return(
        <div className="bg-[#111827] w-full h-screen p-4 flex">
            <div className="w-2/3 flex flex-col gap-2">
                <div className="w-full flex flex-col gap-2">
                    <h1 className="text-3xl font-bold">Lập Trình JavaScript Cơ Bản</h1>
                    <p className="text-sm">Học Javascript cơ bản phù hợp cho người chưa từng học lập trình. Với hơn 100 bài học và có bài tập thực hành sau mỗi bài học.</p>
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Bạn sẽ học được gì?</h1>
                    <div className="grid grid-cols-2 gap-1">
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Hiểu chi tiết về các khái niệm cơ bản trong JS</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Tự tin khi phỏng vấn với kiến thức vững chắc</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Nắm chắc các tính năng trong phiên bản ES6</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Ghi nhớ các khái niệm nhờ bài tập trắc nghiệm</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Các bài thực hành như Tabs, Music Player</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Xây dựng được website đầu tiên kết hợp với JS</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Có nền tảng để học các thư viện và framework JS</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Thành thạo DOM APIs để tương tác với trang web</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Nâng cao tư duy với các bài kiểm tra với testcases</p></div>
                        <div className='flex gap-2'><Check size={20} className='text-blue-400'/><p>Nhận chứng chỉ khóa học do F8 cấp</p></div>
                    </div>
                </div>
                <div>
                    <div>
                        <p className='text-2xl font-bold'>Nội dung khóa học</p>
                        <div className='flex justify-between'>
                            <div className='flex gap-2 text-sm'>
                                <p className='font-bold'>6</p>
                                <p className=''>chương</p>
                                <p className='font-bold'>.</p>
                                <p className='font-bold'>30</p>
                                <p className=''>bài học</p>
                                <p className='font-bold'>.</p>
                                <p className=''>Thời lượng</p>
                                <p className='font-bold'>24 giờ 30 phút</p>
                            </div>
                            <div>
                                <button className='text-blue-400 cursor-pointer hover:text-blue-300 text-sm'>Mở rộng tất cả</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className='w-1/3'>
                <div className='flex flex-col gap-3 w-full justify-center items-center'>
                    <img src="https://files.fullstack.edu.vn/f8-prod/courses/1.png" alt="" className='w-90 rounded-xl'/>
                    <h1 className='text-3xl text-green-400'>MIỄN PHÍ</h1>
                    <button className='p-2 bg-blue-500 rounded-md'>ĐĂNG KÝ HỌC</button>
                </div>
            </div>
        </div>
    )
}