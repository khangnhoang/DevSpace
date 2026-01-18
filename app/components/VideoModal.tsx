// app/components/VideoModal.tsx
import { X } from "lucide-react";

export default function VideoModal({ videoId, onClose }: { videoId: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-500 z-10 bg-black/50 rounded-full p-1">
          <X size={24} />
        </button>
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="Course Trailer"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}