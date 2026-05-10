import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)]",
        "border border-[var(--color-border)] rounded-[var(--radius-m)]",
        "placeholder:text-[var(--color-text-weak)]",
        "focus:border-[var(--color-primary)] focus:outline-none",
        "disabled:bg-[var(--color-background)] disabled:text-[var(--color-text-weak)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
