import type { AuthMessage } from "./auth-outcomes";

export function AuthMessageBox({ message }: { message: AuthMessage | null }) {
  if (!message) return null;
  return (
    <div
      className={`mt-4 p-3 rounded text-sm text-center font-medium animate-in zoom-in-95 ${message.type === "error" ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"}`}
    >
      {message.text}
    </div>
  );
}
