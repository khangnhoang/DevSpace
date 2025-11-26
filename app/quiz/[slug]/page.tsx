"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { getExerciseByLesson } from "@/lib/supabase";
import { Router } from "lucide-react";

type QuizQuestion = {
  id: number,
  question: string,
  options: string[]
  correctAnswer: string
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correct, setIsCorrect] = useState<boolean | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length-1

  const TryAgain = () => {
    setIsCorrect(null)
    setSelectedOption(null)
  }

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      alert("Đây đã là câu hỏi cuối cùng")
      router.push('/')
      return 
    }
    setCurrentIndex((prev) => prev + 1)
    setIsCorrect(null)
    setSelectedOption(null)
  }

  const handleSubmit = () => {
    if (selectedOption === null){
      alert("vui lòng chọn đáp án")
      return
    }

    const currentCorrectAnswer = questions[currentIndex].correctAnswer
    if (selectedOption === currentCorrectAnswer){
      setIsCorrect(true)
    } else {
      setIsCorrect(false)
    }
  };

  // const [currentQuestion, setCurrenQuestion] = useState(0);
  // const [isSelectedOption, setIsSelectedOption] = useState("");

  useEffect(() => {
    const fetctQuizData = async() => {
      const slug = Array.isArray(params.slug)?params.slug[0]:params.slug;
      if (!slug) return
    
    try {
      setLoading(true)
      setIsCorrect(null)

      const result = await getExerciseByLesson(slug);

      let rawExercises: any[] = [];
      if (Array.isArray(result)){
        rawExercises = [];
      } else {
        rawExercises = result.exercises
      }

    const formatedData: QuizQuestion[] = rawExercises.map((item: any) => ({
        id: item.id,
        question: item.question,
        options: [item.option_a, item.option_b, item.option_c, item.option_d],
        correctAnswer: item.correct_answer
      }))
      
      console.log("Dữ liệu đã xử lí:", formatedData)
      setQuestions(formatedData);
    } 
    catch (error) {
      console.error("lỗi:", error)
    } finally {
      setLoading(false);
    }
  };
  
  fetctQuizData();
  },[params.slug])
  
  if (loading) return <div className="text-white p-10 text-center">⏳ Đang tải câu hỏi...</div>;
  
  if (questions.length === 0) return <div className="text-white p-10 text-center">📭 Bài học này chưa có câu hỏi nào.</div>;

  // Hiển thị thử câu đầu tiên để xem dữ liệu lên chưa
  const demoQuestion = questions[0];



  return (
    <div className="bg-[#2d3748] h-screen w-full flex flex-col justify-center items-center gap-2">
      <h1 className="text-4xl">Test Quiz</h1>
      <p className="text-2xl">Câu hỏi: VN là viết tắt của?</p>
      <div className="border border-gray-500 p-6 rounded-lg bg-[#3a4556]">
        <p className="text-xl mb-4 font-bold">Câu 1: {currentQuestion.question}</p>        
         <form className="flex flex-col gap-4">
          {currentQuestion.options.map((opt, i) => {  
            const type = ["a", "b", "c","d"][i];
            const isSelected = selectedOption === type 
            // 1. Phải bọc input và label trong 1 thẻ div cha (để tránh lỗi React)
            return(
              <div key={i} onClick={() => setSelectedOption(type)} className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer">
              
              <input 
                type="radio" 
                checked={isSelected}
                onChange={() => {}}
                id={`option-${i}`}   // Tạo ID riêng cho từng dòng
                name="quiz_answer"   // QUAN TRỌNG: Phải cùng tên 'name' thì mới chỉ chọn được 1 cái
                className="w-5 h-5 cursor-pointer accent-blue-500" // accent-blue để đổi màu nút radio
              />
              
              {/* htmlFor phải khớp với id của input để bấm vào chữ cũng chọn được */}
              <label htmlFor={`option-${i}`} className="text-lg cursor-pointer select-none flex-1">
                {opt}
              </label>
            </div>
            );         
          })}
        </form>
      </div>
      {correct !== null && (<div className={`mt-5 text-3xl gap-4 flex flex-col justify-center items-center absolute w-[404.32] h-[317.36] rounded-md text-white ${correct?"bg-green-500":"bg-red-500"}
            `}>
              {correct?"Đúng":"Sai"}
              <button onClick={!correct?TryAgain:handleNextQuestion} className="cursor-pointer rounded-xl p-2 bg-gray-500 hover:bg-blue-500 hover:text-black">{correct?"Bài kế tiếp":"Làm lại"}</button>
            </div>)} 
        <div className="w-1/1 flex justify-center p-2">
          <button onClick= {handleSubmit} className="text-black bg-gray-200 rounded-md cursor-pointer text-xl p-2 hover:bg-blue-400 hover:text-white">
            Gửi kết quả
          </button>
        </div>
      </div>
  );
}
