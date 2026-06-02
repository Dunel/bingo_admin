import { cn } from "@/lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedMap = {
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  full: "rounded-full",
} as const;

export function Skeleton({ className, rounded = "md", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer", roundedMap[rounded], className)}
      {...props}
    />
  );
}
