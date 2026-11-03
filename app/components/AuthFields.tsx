"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The look of the old `.input-field` class on the shadcn `Input`: the border, padding, radius and focus ring the auth
// cards had, at the usage site (frontend-design). The last two rules hide the password reveal and clear buttons that
// Edge draws over the field, which the old class hid the same way.
export const AUTH_INPUT_CLASS =
  "h-auto w-full rounded-lg border-gray-200 bg-transparent px-4 py-3 text-base leading-normal text-gray-700 shadow-none placeholder:text-[#757575] transition-all duration-200 focus-visible:border-blue-600 focus-visible:ring-[3px] focus-visible:ring-blue-600/10 md:text-base [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-password-reveal-button]:hidden [&::-webkit-password-reveal-button]:appearance-none";

export function AuthInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn(AUTH_INPUT_CLASS, className)} {...props} />;
}

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  visible: boolean;
  onToggle: () => void;
  // The sign-up and reset forms keep the toggle out of the tab order, the sign-in form does not (as before).
  toggleTabIndex?: number;
};

// An input with the eye toggle drawn over its right edge. The toggle has a name for screen readers.
export function PasswordInput({ visible, onToggle, toggleTabIndex, className, ...props }: PasswordInputProps) {
  return (
    <div className="relative">
      <AuthInput type={visible ? "text" : "password"} className={className} {...props} />
      <button
        type="button"
        tabIndex={toggleTabIndex}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={onToggle}
        className="cursor-pointer absolute right-3 top-4 text-gray-400 hover:text-blue-600"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function usePasswordVisibility() {
  const [visible, setVisible] = useState(false);
  return { visible, toggle: () => setVisible((current) => !current) };
}

export const AUTH_SUBMIT_CLASS =
  "flex h-auto w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70";

// The big blue submit button. The icons take their size from a `size-*` class because the Button's own
// `[&_svg:not([class*='size-'])]:size-4` rule would otherwise override the `size` prop.
export function AuthSubmitButton({
  pending,
  label,
  className,
  children,
}: {
  pending: boolean;
  // The button's name while the spinner replaces its text, so it keeps one for screen readers.
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn("cursor-pointer mt-6", AUTH_SUBMIT_CLASS, className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          <span className="sr-only">{label}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
