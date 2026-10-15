import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";
export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  size?: StatusBadgeSize;
  /** Shows the colored dot before the label. Default: true. */
  enableDot?: boolean;
  /** Makes the dot pulse (for live states such as "Pagado" just now). Default: false. */
  pulse?: boolean;
  /** Secondary line under the badge (e.g. "Resta S/ 40.00"). */
  detail?: ReactNode;
  className?: string;
  children: ReactNode;
}

const PILL: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-100/80 text-emerald-900 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-200",
  danger: "bg-rose-100/80 text-rose-900 border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-200",
  warning: "bg-amber-100/80 text-amber-900 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-200",
  info: "bg-blue-100/80 text-blue-900 border-blue-300/80 dark:bg-blue-950/60 dark:text-blue-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-300/80 dark:bg-slate-800 dark:text-slate-200",
};

const DOT: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-600",
  danger: "bg-rose-600",
  warning: "bg-amber-600",
  info: "bg-blue-600",
  neutral: "bg-slate-500",
};

/** Status pill (the "Pagado / Parcial / Pendiente" of the purchases table). */
export function StatusBadge({
  tone = "neutral",
  size = "md",
  enableDot = true,
  pulse = false,
  detail,
  className,
  children,
}: Readonly<StatusBadgeProps>) {
  return (
    <span className={cn("inline-flex flex-col items-center", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-semibold",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
          PILL[tone]
        )}
      >
        {enableDot ? (
          <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone], pulse && "animate-pulse")} />
        ) : null}
        {children}
      </span>
      {detail ? (
        <span className="mt-0.5 font-mono text-[10px] font-medium text-rose-600 dark:text-rose-400">
          {detail}
        </span>
      ) : null}
    </span>
  );
}
