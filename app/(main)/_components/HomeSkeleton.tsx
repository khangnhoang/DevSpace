// What the visitor sees while the course list is being read on the server (AC8): the banner and six cards, as the
// page showed them while the browser fetched the same list.
const CourseSkeleton = () => (
  <div className="w-full bg-gray-100 rounded-xl overflow-hidden shadow-lg animate-pulse border border-gray-200">
    <div className="h-48 bg-gray-300 w-full"></div>
    <div className="p-4 flex flex-col gap-3">
      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
      <div className="flex justify-between items-center mt-2">
        <div className="h-5 bg-gray-300 rounded w-1/3"></div>
        <div className="h-8 bg-gray-300 rounded-lg w-20"></div>
      </div>
    </div>
  </div>
);

const BannerSkeleton = () => (
  <div className="w-full h-[400px] md:h-[500px] bg-gray-200 animate-pulse rounded-xl"></div>
);

export default function HomeSkeleton() {
  return (
    <div data-testid="home-skeleton">
      <div className="w-full mt-6 md:mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <BannerSkeleton />
        </div>
      </div>
      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="block w-2 h-8 bg-blue-600 rounded-sm"></span>
            Danh sách khóa học
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <CourseSkeleton key={i} />
            ))}
        </div>
      </div>
    </div>
  );
}
