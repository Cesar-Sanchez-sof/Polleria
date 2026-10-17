"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedTabTone = "neutral" | "success" | "danger" | "warning" | "info" | "cyan" | "purple" | "brand";
export type SegmentedTabsSize = "sm" | "md" | "lg";
export type SegmentedTabsVariant = "segmented" | "underline";
export type SegmentedTabsRounded = "md" | "lg" | "xl" | "full";

export interface SegmentedTabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Number (or short text such as "3/6") shown in the badge. Ignored when `enableCount` is false. */
  count?: number | string;
  /** Color of the badge and of the label while the tab is active. */
  tone?: SegmentedTabTone;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedTabsProps<T extends string = string> {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Shows the count badge of each tab that defines `count`. Default: true. */
  enableCount?: boolean;
  /** Shows the `icon` of each tab. Default: true. */
  enableIcons?: boolean;
  /** Colors badges and active labels with the tone of each tab. Default: true. */
  enableTones?: boolean;
  /** Hides the badge when the count is 0. Default: false. */
  hideZeroCount?: boolean;
  /** Counts above this value are shown as "max+" (e.g. "99+"). Default: no limit. */
  maxCount?: number;
  size?: SegmentedTabsSize;
  variant?: SegmentedTabsVariant;
  rounded?: SegmentedTabsRounded;
  /** Makes the tabs share the full width. Default: false. */
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE: Record<SegmentedTabsSize, { trigger: string; badge: string }> = {
  sm: { trigger: "px-2.5 py-1 text-[11px]", badge: "text-[9px] px-1.5" },
  md: { trigger: "px-3 py-1.5 text-xs", badge: "text-[10px] px-1.5" },
  lg: { trigger: "px-4 py-2 text-sm", badge: "text-xs px-2" },
};

const ROUNDED: Record<SegmentedTabsRounded, { list: string; trigger: string }> = {
  md: { list: "rounded-lg", trigger: "rounded-md" },
  lg: { list: "rounded-xl", trigger: "rounded-lg" },
  xl: { list: "rounded-2xl", trigger: "rounded-xl" },
  full: { list: "rounded-full", trigger: "rounded-full" },
};

const ACTIVE_LABEL: Record<SegmentedTabTone, string> = {
  neutral: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-400",
  danger: "text-rose-700 dark:text-rose-400",
  warning: "text-amber-700 dark:text-amber-400",
  info: "text-blue-700 dark:text-blue-400",
  cyan: "text-cyan-700 dark:text-cyan-400",
  purple: "text-purple-700 dark:text-purple-400",
  brand: "text-red-700 dark:text-red-400",
};

const BADGE: Record<SegmentedTabTone, string> = {
  neutral: "bg-muted text-foreground",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  brand: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const UNDERLINE_ACTIVE: Record<SegmentedTabTone, string> = {
  neutral: "border-foreground",
  success: "border-emerald-600",
  danger: "border-rose-600",
  warning: "border-amber-600",
  info: "border-blue-600",
  cyan: "border-cyan-600",
  purple: "border-purple-600",
  brand: "border-red-700",
};

function formatCount(count: number | string, maxCount?: number): string {
  if (typeof count === "number" && maxCount !== undefined && count > maxCount) return `${maxCount}+`;
  return String(count);
}

/**
 * Segmented control / tab bar used to filter a view by state ("Todos 6 | Activos 4 | Inactivos 2").
 * Controlled: the parent owns `value`. Fully keyboard accessible (arrows, Home, End).
 */
export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onValueChange,
  enableCount = true,
  enableIcons = true,
  enableTones = true,
  hideZeroCount = false,
  maxCount,
  size = "md",
  variant = "segmented",
  rounded = "xl",
  fullWidth = false,
  className,
  ariaLabel,
}: Readonly<SegmentedTabsProps<T>>) {
  const listRef = useRef<HTMLDivElement>(null);
  const sizeClasses = SIZE[size];
  const roundedClasses = ROUNDED[rounded];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next < 0 || enabled.length === 0) return;
    event.preventDefault();
    onValueChange(enabled[next].value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]:not(:disabled)");
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "items-center",
        fullWidth ? "flex w-full" : "inline-flex",
        variant === "segmented"
          ? cn(
              "gap-0.5 border border-slate-200/60 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900",
              roundedClasses.list
            )
          : "gap-1 border-b border-slate-200 dark:border-slate-800",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const tone = enableTones ? (item.tone ?? "neutral") : "neutral";
        const showCount =
          enableCount && item.count !== undefined && !(hideZeroCount && (item.count === 0 || item.count === "0"));

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
              sizeClasses.trigger,
              fullWidth && "flex-1",
              variant === "segmented"
                ? cn(
                    roundedClasses.trigger,
                    active
                      ? cn("bg-white font-semibold shadow-2xs dark:bg-slate-800", ACTIVE_LABEL[tone])
                      : "text-muted-foreground hover:text-foreground"
                  )
                : cn(
                    "-mb-px border-b-2",
                    active
                      ? cn("font-semibold", ACTIVE_LABEL[tone], UNDERLINE_ACTIVE[tone])
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )
            )}
          >
            {enableIcons && item.icon ? <span className="shrink-0 [&_svg]:size-3.5">{item.icon}</span> : null}
            <span>{item.label}</span>
            {showCount ? (
              <span
                className={cn(
                  "rounded-full py-0.5 font-mono font-semibold leading-none",
                  sizeClasses.badge,
                  BADGE[tone]
                )}
              >
                {formatCount(item.count as number | string, maxCount)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
