export default function CourseDetailLoading() {
  return (
    <div className="bg-[#111827] w-full min-h-screen p-4 flex md:p-8 flex-col lg:flex-row gap-8 justify-center">
      <div className="w-full lg:w-2/3 flex flex-col gap-8 animate-pulse">
        <div className="w-full flex flex-col gap-4">
          <div className="h-10 bg-gray-700 rounded-md w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded-md w-full"></div>
          <div className="h-4 bg-gray-700 rounded-md w-5/6"></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-8 bg-gray-700 rounded-md w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="w-5 h-5 bg-gray-700 rounded-full shrink-0"></div>
                <div className="h-4 bg-gray-700 rounded-md w-full"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="h-8 bg-gray-700 rounded-md w-1/4"></div>
            <div className="h-6 bg-gray-700 rounded-md w-1/6"></div>
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 bg-gray-700 rounded-lg w-full border border-gray-600"
              ></div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/3 animate-pulse">
        <div className="flex flex-col gap-5 w-full bg-[#1f2937] p-5 rounded-xl border border-gray-700 lg:sticky lg:top-8">
          <div className="aspect-video w-full bg-gray-700 rounded-lg"></div>
          <div className="flex flex-col gap-2 items-center">
            <div className="h-10 bg-gray-700 rounded-md w-1/2"></div>
            <div className="h-4 bg-gray-700 rounded-md w-1/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
