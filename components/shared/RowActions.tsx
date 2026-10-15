import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RowActionTone = "neutral" | "amber" | "blue" | "emerald" | "rose";
export type RowActionsMode = "icon" | "label" | "both";
export type RowActionsVariant = "ghost" | "outline" | "soft";
export type RowActionsSize = "sm" | "md";

export interface RowAction {
  key: string;
  /** Text of the button. Shown according to `mode`; always used as tooltip / aria-label. */
  label: string;
  icon?: ReactNode;
  tone?: RowActionTone;
  onClick?: () => void;
  /** Renders the action as a link. */
  href?: string;
  disabled?: boolean;
  /** Hides the action (e.g. "Pagar" on paid invoices). */
  hidden?: boolean;
  /** Overrides the table-level `mode` for this action. */
  mode?: RowActionsMode;
}

export interface RowActionsProps {
  actions: readonly RowAction[];
  /** "icon" only icons, "label" only text, "both" icon and text. Default: "icon". */
  mode?: RowActionsMode;
  variant?: RowActionsVariant;
  size?: RowActionsSize;
  /** Alignment inside the cell. Default: "end". */
  align?: "start" | "center" | "end";
  className?: string;
}

const TEXT: Record<RowActionTone, string> = {
  neutral: "text-slate-600 dark:text-slate-300",
  amber: "text-amber-700 dark:text-amber-400",
  blue: "text-blue-700 dark:text-blue-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
  rose: "text-rose-700 dark:text-rose-400",
};

const HOVER: Record<RowActionTone, string> = {
  neutral: "hover:bg-slate-100 dark:hover:bg-slate-800",
  amber: "hover:bg-amber-50 dark:hover:bg-amber-950/40",
  blue: "hover:bg-blue-50 dark:hover:bg-blue-950/40",
  emerald: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
  rose: "hover:bg-rose-50 dark:hover:bg-rose-950/40",
};

const SOFT: Record<RowActionTone, string> = {
  neutral: "bg-slate-100 dark:bg-slate-800",
  amber: "bg-amber-50 dark:bg-amber-950/50",
  blue: "bg-blue-50 dark:bg-blue-950/50",
  emerald: "bg-emerald-50 dark:bg-emerald-950/50",
  rose: "bg-rose-50 dark:bg-rose-950/50",
};

const OUTLINE: Record<RowActionTone, string> = {
  neutral: "border-slate-200 dark:border-slate-700",
  amber: "border-amber-200 dark:border-amber-900/60",
  blue: "border-blue-200 dark:border-blue-900/60",
  emerald: "border-emerald-200 dark:border-emerald-900/60",
  rose: "border-rose-200 dark:border-rose-900/60",
};

/**
 * Action buttons of a table row (edit, deactivate, pay...). Each button can show only an icon,
 * only text or both. Clicks never bubble to the row, so they do not trigger `onRowClick`.
 */
export function RowActions({
  actions,
  mode = "icon",
  variant = "ghost",
  size = "md",
  align = "end",
  className,
}: Readonly<RowActionsProps>) {
  const visible = actions.filter((action) => !action.hidden);

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        align === "end" && "justify-end",
        align === "center" && "justify-center",
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {visible.map((action) => {
        const tone = action.tone ?? "neutral";
        const actionMode = action.mode ?? mode;
        const showIcon = Boolean(action.icon) && actionMode !== "label";
        const showLabel = actionMode !== "icon" || !action.icon;
        const classes = cn(
          "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
          size === "sm" ? "h-7 text-[11px]" : "h-8 text-xs",
          showLabel ? (size === "sm" ? "px-2" : "px-2.5") : size === "sm" ? "w-7" : "w-8",
          TEXT[tone],
          variant === "ghost" && HOVER[tone],
          variant === "soft" && cn(SOFT[tone], "hover:brightness-95"),
          variant === "outline" && cn("border bg-transparent", OUTLINE[tone], HOVER[tone])
        );
        const content = (
          <>
            {showIcon ? action.icon : null}
            {showLabel ? <span>{action.label}</span> : null}
          </>
        );

        return action.href && !action.disabled ? (
          <Link key={action.key} href={action.href} title={action.label} aria-label={action.label} className={classes}>
            {content}
          </Link>
        ) : (
          <button
            key={action.key}
            type="button"
            title={action.label}
            aria-label={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
