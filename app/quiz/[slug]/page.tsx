"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExerciseByLesson } from "@/lib/supabase";

type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // State quản lý logic bài thi
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correct, setIsCorrect] = useState<boolean | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Các biến tính toán (Derived State)
  const currentQuestion = questions[currentIndex];
  const isLastQuestion =
    questions.length > 0 && currentIndex === questions.length - 1;

  // --- 1. LOGIC NÚT BẤM ---

  const handleTryAgain = () => {
    setIsCorrect(null); // Ẩn bảng kết quả
    setSelectedOption(null); // Reset lựa chọn để user chọn lại
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      alert("Chúc mừng! Bạn đã hoàn thành tất cả bài tập 🎉");
      // TODO: Gọi API lưu tiến độ ở đây (Buổi sau làm)
      router.push("/"); // Hoặc router.back() để về bài học
      return;
    }

    // Chuyển sang câu tiếp theo
    setCurrentIndex((prev) => prev + 1);
    setIsCorrect(null); // Ẩn bảng kết quả
    setSelectedOption(null); // Reset lựa chọn
  };

  const handleSubmit = () => {
    if (selectedOption === null) {
      alert("Vui lòng chọn đáp án trước khi gửi!");
      return;
    }

    const currentCorrectAnswer = currentQuestion.correctAnswer;
    if (selectedOption === currentCorrectAnswer) {
      setIsCorrect(true);
    } else {
      setIsCorrect(false);
    }
  };

  // --- 2. FETCH DATA ---

  useEffect(() => {
    const fetchQuizData = async () => {
      const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
      if (!slug) return;

      try {
        setLoading(true);
        // Reset state khi load bài mới
        setIsCorrect(null);
        setCurrentIndex(0);
        setSelectedOption(null);

        const result = await getExerciseByLesson(slug);

        if(!result){
          setLoading(false);
          return;
        }

        let rawExercises: any[] = [];
        // Kiểm tra kỹ cấu trúc trả về của API
        if (result && Array.isArray(result.exercises)) {
          rawExercises = result.exercises;
        } else if (Array.isArray(result)) {
          rawExercises = result;
        }

        const formattedData: QuizQuestion[] = rawExercises.map((item: any) => ({
          id: item.id,
          question: item.question, // Nhớ check xem DB là 'question' hay 'quest'
          options: [item.option_a, item.option_b, item.option_c, item.option_d],
          correctAnswer: item.correct_answer,
        }));

        setQuestions(formattedData);
      } catch (error) {
        console.error("Lỗi tải bài tập:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [params.slug]);

  // --- 3. RENDER ---

  if (loading)
    return (
      <div className="text-white p-10 text-center text-xl animate-pulse">
        ⏳ Đang tải câu hỏi...
      </div>
    );

  if (questions.length === 0)
    return (
      <div className="text-white p-10 text-center">
        <p className="text-2xl mb-4">📭 Bài học này chưa có câu hỏi nào.</p>
        <button
          onClick={() => router.back()}
          className="text-blue-400 hover:underline"
        >
          Quay về bài học
        </button>
      </div>
    );

  // Bảo vệ: Nếu currentIndex vượt quá mảng (hiếm gặp)
  if (!currentQuestion) return null;

  return (
    <div className="bg-[#2d3748] min-h-screen w-full flex flex-col justify-center items-center gap-4 p-4">
      <h1 className="text-4xl text-white font-bold mb-2">Test Quiz</h1>
      <p className="text-xl text-gray-300">
        Câu hỏi {currentIndex + 1} / {questions.length}
      </p>

      {/* --- KHUNG CÂU HỎI (Có Overlay khi hiện kết quả) --- */}
      <div className="relative border border-gray-600 p-8 rounded-xl bg-[#3a4556] w-full max-w-2xl shadow-2xl overflow-hidden">
        <p className="text-xl mb-6 font-bold text-white">
          {currentQuestion.question}
        </p>

        <div className="flex flex-col gap-4">
          {currentQuestion.options.map((opt, i) => {
            const type = ["a", "b", "c", "d"][i];
            const isSelected = selectedOption === type;

            return (
              <div
                key={i}
                // Chỉ cho chọn khi chưa hiện kết quả (correct === null)
                onClick={() => correct === null && setSelectedOption(type)}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all border-2
                    ${
                      isSelected
                        ? "bg-blue-600 border-blue-400 shadow-md"
                        : "bg-[#2d3748] border-transparent hover:bg-gray-600"
                    }
                    ${correct !== null ? "cursor-default opacity-80" : ""} 
                `}
              >
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => {}} // Dummy handler để React ko warn
                  id={`option-${i}`}
                  name="quiz_answer"
                  className="w-5 h-5 cursor-pointer accent-white"
                  disabled={correct !== null} // Disable radio khi đã nộp
                />

                <label
                  htmlFor={`option-${i}`}
                  className="text-lg text-white cursor-pointer select-none flex-1"
                >
                  {opt}
                </label>
              </div>
            );
          })}
        </div>

        {/* --- OVERLAY KẾT QUẢ (Đè lên câu hỏi) --- */}
        {correct !== null && (
          <div
            className={`absolute inset-0 flex flex-col justify-center items-center gap-6 text-white animate-in fade-in zoom-in duration-200
                ${correct ? "bg-green-600/95" : "bg-red-600/95"} 
            `}
          >
            <div className="text-5xl font-bold">
              {correct ? "Chính xác! 🎉" : "Sai rồi! 😢"}
            </div>

            <button
              onClick={correct ? handleNextQuestion : handleTryAgain}
              className="cursor-pointer rounded-full px-8 py-3 bg-white text-black text-xl font-bold hover:bg-gray-200 hover:scale-105 transition-transform shadow-lg"
            >
              {correct
                ? isLastQuestion
                  ? "Hoàn thành 🏁"
                  : "Bài kế tiếp ➡"
                : "Thử lại ↺"}
            </button>
          </div>
        )}
      </div>

      {/* --- KHUNG BUTTON CUỐI TRANG --- */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 text-lg bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
        >
          Quay về
        </button>

        <button
          onClick={handleSubmit}
          disabled={correct !== null || !selectedOption} // Disable khi đã nộp hoặc chưa chọn
          className={`px-8 py-2 text-lg rounded-lg font-bold transition-colors
                ${
                  correct === null && selectedOption
                    ? "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }
            `}
        >
          Gửi kết quả
        </button>
      </div>
    </div>
  );
}
