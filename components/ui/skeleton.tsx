"use client";

import type { HTMLAttributes } from "react";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-skeleton", className)} aria-hidden="true" {...props} />;
}
