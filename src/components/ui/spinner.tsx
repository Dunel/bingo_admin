import * as React from "react";
import { cn } from "@/lib/cn";

type SpinnerSize = "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, { box: string; border: string }> = {
  sm: { box: "h-3.5 w-3.5", border: "border-[1.5px]" },
  md: { box: "h-5 w-5", border: "border-2" },
  lg: { box: "h-7 w-7", border: "border-[3px]" },
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  const { box, border } = sizeMap[size];
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block rounded-full animate-spin",
        border,
        "border-current border-t-transparent opacity-80",
        box,
        className,
      )}
      {...props}
    />
  );
}
