export default function QuizPage() {
  return (
    <div className="bg-[#2d3748] h-screen w-full flex flex-col justify-center items-center gap-2">
      <h1 className="text-4xl">Test Quiz</h1>
      <p className="text-2xl">Câu hỏi: VN là viết tắt của?</p>
      <div className="flex flex-col gap-2 w-1/3">
        <div className="flex flex-row text-2xl bg-[#575F6D] rounded-md p-2 gap-2 cursor-pointer hover:bg-blue-400 hover:text-white">
          <input type="radio" className="cursor-pointer" name="quiz" />
          <p>Việt Nam</p>
        </div>
        <div className="flex flex-row text-2xl bg-[#575F6D] rounded-md p-2 gap-2 cursor-pointer hover:bg-blue-400 hover:text-white">
          <input type="radio" className="cursor-pointer" name="quiz" />
          <p>Việt Nam</p>
        </div>
        <div className="flex flex-row text-2xl bg-[#575F6D] rounded-md p-2 gap-2 cursor-pointer hover:bg-blue-400 hover:text-white">
          <input type="radio" className="cursor-pointer" name="quiz" />
          <p>Việt Nam</p>
        </div>
        <div className="flex flex-row text-2xl bg-[#575F6D] rounded-md p-2 gap-2 cursor-pointer hover:bg-blue-400 hover:text-white">
          <input type="radio" className="cursor-pointer" name="quiz" />
          <p>Việt Nam</p>
        </div>
        <div className="w-1/1 flex justify-center p-2">
          <button className="text-black bg-gray-200 rounded-md cursor-pointer text-xl p-2 hover:bg-blue-400 hover:text-white">
            Gửi kết quả
          </button>
        </div>
      </div>
    </div>
  );
}
