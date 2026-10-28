"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// The surface is set per tone, never from --background/--foreground: those flip with the OS colour
// scheme, while the admin pages are always dark and the learner pages always light.
const TONES = {
  admin: {
    content: "border-gray-700 bg-[#191C24] text-gray-100",
    title: "text-white",
    description: "text-gray-400",
    cancel:
      "border-gray-600 bg-transparent text-gray-200 hover:bg-gray-700 hover:text-white",
  },
  learner: {
    content: "border-gray-200 bg-white text-gray-900",
    title: "text-gray-900",
    description: "text-gray-600",
    cancel:
      "border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900",
  },
} as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  tone: keyof typeof TONES;
  // The caller's handler already reports its own success or error; a rejection is swallowed here
  // so a failed action closes the dialog without an unhandled rejection.
  onConfirm: () => Promise<unknown>;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  tone,
  onConfirm,
}: Props) {
  const [pending, setPending] = useState(false);
  // A ref, not only state: two clicks can land before the disabled attribute renders.
  const running = useRef(false);
  const styles = TONES[tone];
  // Radix returns focus only to its own Trigger, and this dialog is controlled without one. Callers mount it
  // when it opens, so the element focused at mount is the control that opened it.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement
  );

  const handleConfirm = async (e: React.MouseEvent) => {
    // Radix closes the dialog on action click; hold it open until the action settles.
    e.preventDefault();
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await onConfirm();
    } catch {
      // reported by the caller's own toast
    } finally {
      running.current = false;
      setPending(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && running.current) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className={styles.content}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (opener instanceof HTMLElement) opener.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={styles.title}>{title}</AlertDialogTitle>
          <AlertDialogDescription className={styles.description}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            className={cn("cursor-pointer", styles.cancel)}
          >
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
            className="cursor-pointer"
          >
            {pending && <Loader2 className="animate-spin" size={16} />}
            {pending ? "Đang xử lý..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
