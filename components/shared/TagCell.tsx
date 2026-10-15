import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TagTone = "amber" | "blue" | "emerald" | "rose" | "indigo" | "neutral";
export type TagVariant = "soft" | "outline" | "solid";
export type TagSize = "sm" | "md";

export interface TagProps {
  tone?: TagTone;
  variant?: TagVariant;
  size?: TagSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const SOFT: Record<TagTone, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/60",
  neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

const OUTLINE: Record<TagTone, string> = {
  amber: "bg-transparent text-amber-700 border-amber-300 dark:text-amber-300",
  blue: "bg-transparent text-blue-700 border-blue-300 dark:text-blue-300",
  emerald: "bg-transparent text-emerald-700 border-emerald-300 dark:text-emerald-300",
  rose: "bg-transparent text-rose-700 border-rose-300 dark:text-rose-300",
  indigo: "bg-transparent text-indigo-700 border-indigo-300 dark:text-indigo-300",
  neutral: "bg-transparent text-slate-700 border-slate-300 dark:text-slate-300",
};

const SOLID: Record<TagTone, string> = {
  amber: "bg-amber-500 text-white border-amber-500",
  blue: "bg-blue-600 text-white border-blue-600",
  emerald: "bg-emerald-600 text-white border-emerald-600",
  rose: "bg-rose-600 text-white border-rose-600",
  indigo: "bg-indigo-600 text-white border-indigo-600",
  neutral: "bg-slate-700 text-white border-slate-700",
};

const VARIANTS: Record<TagVariant, Record<TagTone, string>> = { soft: SOFT, outline: OUTLINE, solid: SOLID };

/** Small label ("RUC", "DNI", "Activo"...) with tone, variant and size. */
export function Tag({ tone = "neutral", variant = "soft", size = "md", icon, className, children }: Readonly<TagProps>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-bold uppercase tracking-wide [&_svg]:size-3",
        size === "sm" ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        VARIANTS[variant][tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export interface TagCellProps {
  /** Text of the tag, e.g. "RUC". */
  tag: ReactNode;
  /** Value next to the tag, e.g. the document number. */
  value?: ReactNode;
  tone?: TagTone;
  variant?: TagVariant;
  size?: TagSize;
  tagIcon?: ReactNode;
  /** Side of the tag relative to the value. Default: "start". */
  tagPosition?: "start" | "end";
  /** Shows the tag. Default: true. */
  enableTag?: boolean;
  /** Writes the value in monospace and bold. Default: true. */
  valueMono?: boolean;
  /** Stacks tag and value in two lines. Default: false. */
  stacked?: boolean;
  /** Several tags (e.g. role + status) shown after the value. */
  extraTags?: readonly { label: ReactNode; tone?: TagTone; variant?: TagVariant }[];
  className?: string;
}

/** Table cell made of a tag and a value: "RUC 20608300393". */
export function TagCell({
  tag,
  value,
  tone = "amber",
  variant = "soft",
  size = "md",
  tagIcon,
  tagPosition = "start",
  enableTag = true,
  valueMono = true,
  stacked = false,
  extraTags,
  className,
}: Readonly<TagCellProps>) {
  const tagNode = enableTag ? (
    <Tag tone={tone} variant={variant} size={size} icon={tagIcon}>
      {tag}
    </Tag>
  ) : null;
  const valueNode = value ? (
    <span className={cn("text-sm text-foreground", valueMono && "font-mono font-bold")}>{value}</span>
  ) : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", stacked && "flex-col items-start gap-1", className)}>
      {tagPosition === "start" ? tagNode : null}
      {valueNode}
      {tagPosition === "end" ? tagNode : null}
      {extraTags?.map((extra, index) => (
        <Tag key={index} tone={extra.tone ?? "neutral"} variant={extra.variant ?? variant} size={size}>
          {extra.label}
        </Tag>
      ))}
    </div>
  );
}
