export default function HeroBanner() {
  return (
    <div className="w-full bg-white flex justify-center px-5">
      <div className="w-full h-40 bg-[#1D2731] flex justify-between p-5 rounded-2xl">
        <div className="flex flex-col text-white w-2/4 justify-center gap-2">
          <h1 className="text-3xl font-bold">Mở bán khóa học HTML & CSS Pro</h1>
          <span className="text-sm">
            Từ ngày 02/12/2025 Khóa học sẽ có giá trị 1.000k. Khi khóa học hoàn
            thiện sẽ trở về giá gốc.
          </span>
          <button className="border w-1/3 hover:bg-blue-500 rounded-2xl cursor-pointer py-1.5">HỌC THỬ MIỄN PHÍ</button>
        </div>
        <img
          src="https://khoahocsinhvien.com/wp-content/uploads/2023/05/Khoa-hoc-HTML-CSS-Master-from-Zero-to-Hero.jpg"
          alt=""
          className="w-50 h-50"
        />
      </div>
    </div>
  );
}
