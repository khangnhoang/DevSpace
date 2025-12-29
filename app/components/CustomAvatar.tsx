"use client";

import Image from "next/image";

interface CustomAvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackText?: string;
  fontSize?: string; // 1. Thêm prop này
}

export default function CustomAvatar({
  src,
  alt = "User Avatar",
  className = "w-8 h-8",
  fallbackText = "DS",
  fontSize = "text-xs sm:text-sm", // 2. Set mặc định là nhỏ (cho Header)
}: CustomAvatarProps) {
  if (src) {
    return (
      <div className={`relative rounded-full overflow-hidden border border-gray-200 ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-blue-600 text-white font-bold rounded-full border border-blue-400 ${className}`}
    >
      {/* 3. Thay class cứng bằng biến fontSize */}
      <span className={`uppercase ${fontSize}`}>{fallbackText}</span>
    </div>
  );
}