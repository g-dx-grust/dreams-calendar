import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]",
        secondary:
          "bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] hover:bg-[var(--color-background)]",
        danger:
          "bg-[var(--color-danger)] text-white hover:opacity-90",
        text: "bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-[var(--radius-s)]",
        md: "h-9 px-4 text-[14px] rounded-[var(--radius-m)]",
        lg: "h-10 px-5 text-[15px] rounded-[var(--radius-m)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
