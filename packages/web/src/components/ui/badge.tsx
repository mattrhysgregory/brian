import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded border border-border px-1.5 py-px text-[11px] font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
