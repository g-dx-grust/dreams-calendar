import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-[13px] font-medium text-[var(--color-text-mid)]",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
