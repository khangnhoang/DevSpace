import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Hàm này nhận vào vô số class, gộp lại và xử lý xung đột
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}