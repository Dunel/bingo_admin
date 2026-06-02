import * as React from "react";
import { cn } from "@/lib/cn";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, children, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn("text-sm font-semibold text-[var(--color-fg)]", className)}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-[var(--color-danger)]">
          *
        </span>
      ) : null}
    </label>
  );
});
