import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatCardTone = "blue" | "emerald" | "indigo" | "cyan" | "purple" | "amber" | "rose" | "brand" | "neutral";
export type StatCardValueSize = "md" | "lg" | "xl";
export type StatCardLayout = "icon-first" | "label-first" | "tinted";
export type StatCardOrientation = "horizontal" | "vertical";

export interface StatCardProps {
  /** Small caption of the card, e.g. "Compras del Período". */
  label: ReactNode;
  /** Main number or text. Optional: a card can show only the label and a note (e.g. a channels info card). */
  value?: ReactNode;
  /** Text next to the value, e.g. "comprobantes". */
  unit?: ReactNode;
  /** Icon drawn inside the colored square. */
  icon?: ReactNode;
  /** Pill at the top right (e.g. "Este Mes (Octubre)", "PEN (S/)"). Only in the "icon-first" layout. */
  badge?: ReactNode;
  /** Icon shown before the badge text. */
  badgeIcon?: ReactNode;
  /** Writes the badge in monospace (useful for currencies and percentages). Default: false. */
  badgeMono?: boolean;
  /** Left and right text of the footer line. */
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  /** Progress bar (0-100) shown between the value and the footer. */
  progress?: number;
  tone?: StatCardTone;
  /**
   * "icon-first": icon on the left; at its right the label and the badge on one line, then the value using the full width (purchases dashboard).
   * "label-first": uppercase label in the tone color with the icon at its right (sales summary).
   * "tinted": card filled with the tone color, solid icon square, label, value and a note (kitchen summary).
   * Default: "icon-first".
   */
  layout?: StatCardLayout;
  /** Only "tinted": icon beside the text ("horizontal") or centered above it ("vertical"). Default: "horizontal". */
  orientation?: StatCardOrientation;
  /** Paints the value with the tone color. Default: false (neutral text). */
  colorValue?: boolean;
  valueSize?: StatCardValueSize;
  /** Shows the icon square. Default: true. */
  enableIcon?: boolean;
  /** Shows the top-right badge. Default: true. */
  enableBadge?: boolean;
  /** Shows the footer line. Default: true. */
  enableFooter?: boolean;
  /** Draws the divider line above the footer. Default: true in "icon-first", false in "label-first". */
  enableDivider?: boolean;
  /** Shows the progress bar when `progress` is defined. Default: true. */
  enableProgress?: boolean;
  /** Soft gradient tinted with the tone. Default: true in "icon-first", false in "label-first". */
  enableGradient?: boolean;
  /** Raises the shadow on hover. Default: true in "icon-first", false in "label-first". */
  enableHover?: boolean;
  className?: string;
}

interface ToneClasses {
  gradient: string;
  icon: string;
  pill: string;
  value: string;
  label: string;
  bar: string;
  tinted: { card: string; solid: string; label: string; value: string; note: string };
}

const TONES: Record<StatCardTone, ToneClasses> = {
  blue: {
    gradient: "to-blue-50/20 dark:to-blue-950/10",
    icon: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60",
    pill: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900/60",
    value: "text-blue-700 dark:text-blue-300",
    label: "text-blue-700 dark:text-blue-400",
    bar: "bg-blue-500",
    tinted: {
      card: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60",
      solid: "bg-blue-600",
      label: "text-blue-800 dark:text-blue-300",
      value: "text-blue-950 dark:text-blue-100",
      note: "text-blue-700 dark:text-blue-400",
    },
  },
  emerald: {
    gradient: "to-emerald-50/20 dark:to-emerald-950/10",
    icon: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60",
    pill: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900/60",
    value: "text-emerald-700 dark:text-emerald-300",
    label: "text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500",
    tinted: {
      card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60",
      solid: "bg-emerald-600",
      label: "text-emerald-800 dark:text-emerald-300",
      value: "text-emerald-950 dark:text-emerald-100",
      note: "text-emerald-700 dark:text-emerald-400",
    },
  },
  cyan: {
    gradient: "to-cyan-50/20 dark:to-cyan-950/10",
    icon: "bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/60 dark:text-cyan-400 dark:border-cyan-900/60",
    pill: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950/50 dark:border-cyan-900/60",
    value: "text-cyan-700 dark:text-cyan-300",
    label: "text-cyan-700 dark:text-cyan-400",
    bar: "bg-cyan-500",
    tinted: {
      card: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900/60",
      solid: "bg-cyan-600",
      label: "text-cyan-800 dark:text-cyan-300",
      value: "text-cyan-950 dark:text-cyan-100",
      note: "text-cyan-700 dark:text-cyan-400",
    },
  },
  indigo: {
    gradient: "to-indigo-50/20 dark:to-indigo-950/10",
    icon: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900/60",
    pill: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/50 dark:border-indigo-900/60",
    value: "text-indigo-800 dark:text-indigo-300",
    label: "text-indigo-700 dark:text-indigo-400",
    bar: "bg-indigo-500",
    tinted: {
      card: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60",
      solid: "bg-indigo-600",
      label: "text-indigo-800 dark:text-indigo-300",
      value: "text-indigo-950 dark:text-indigo-100",
      note: "text-indigo-700 dark:text-indigo-400",
    },
  },
  purple: {
    gradient: "to-purple-50/20 dark:to-purple-950/10",
    icon: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900/60",
    pill: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/50 dark:border-purple-900/60",
    value: "text-purple-700 dark:text-purple-300",
    label: "text-purple-700 dark:text-purple-400",
    bar: "bg-purple-500",
    tinted: {
      card: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/60",
      solid: "bg-purple-600",
      label: "text-purple-800 dark:text-purple-300",
      value: "text-purple-950 dark:text-purple-100",
      note: "text-purple-700 dark:text-purple-400",
    },
  },
  amber: {
    gradient: "to-amber-50/20 dark:to-amber-950/10",
    icon: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60",
    pill: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900/60",
    value: "text-amber-800 dark:text-amber-300",
    label: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
    tinted: {
      card: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60",
      solid: "bg-amber-500",
      label: "text-amber-800 dark:text-amber-300",
      value: "text-amber-950 dark:text-amber-100",
      note: "text-amber-700 dark:text-amber-400",
    },
  },
  rose: {
    gradient: "to-rose-50/20 dark:to-rose-950/10",
    icon: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60",
    pill: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-900/60",
    value: "text-rose-800 dark:text-rose-300",
    label: "text-rose-700 dark:text-rose-400",
    bar: "bg-rose-500",
    tinted: {
      card: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60",
      solid: "bg-rose-600",
      label: "text-rose-800 dark:text-rose-300",
      value: "text-rose-950 dark:text-rose-100",
      note: "text-rose-700 dark:text-rose-400",
    },
  },
  brand: {
    gradient: "to-red-50/20 dark:to-red-950/10",
    icon: "bg-red-100 text-red-700 border-red-100 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900/60",
    pill: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900/60",
    value: "text-red-800 dark:text-red-300",
    label: "text-slate-500 dark:text-slate-400",
    bar: "bg-red-600",
    tinted: {
      card: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/60",
      solid: "bg-red-700",
      label: "text-red-800 dark:text-red-300",
      value: "text-red-950 dark:text-red-100",
      note: "text-red-700 dark:text-red-400",
    },
  },
  neutral: {
    gradient: "to-slate-50/40 dark:to-slate-900/20",
    icon: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    pill: "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700",
    value: "text-foreground",
    label: "text-slate-500 dark:text-slate-400",
    bar: "bg-slate-500",
    tinted: {
      card: "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800",
      solid: "bg-slate-700",
      label: "text-slate-700 dark:text-slate-300",
      value: "text-slate-900 dark:text-slate-100",
      note: "text-slate-600 dark:text-slate-400",
    },
  },
};

const VALUE_SIZE: Record<StatCardValueSize, string> = {
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
  xl: "text-3xl sm:text-4xl",
};

/**
 * KPI card. "icon-first" is the purchases dashboard card (icon, badge, label, value, footer);
 * "label-first" is the sales summary card (uppercase tone-colored label with the icon at the right).
 */
export function StatCard({
  label,
  value,
  unit,
  icon,
  badge,
  badgeIcon,
  badgeMono = false,
  footerLeft,
  footerRight,
  progress,
  tone = "blue",
  layout = "icon-first",
  orientation = "horizontal",
  colorValue = false,
  valueSize,
  enableIcon = true,
  enableBadge = true,
  enableFooter = true,
  enableDivider,
  enableProgress = true,
  enableGradient,
  enableHover,
  className,
}: Readonly<StatCardProps>) {
  const classes = TONES[tone];
  const labelFirst = layout === "label-first";
  const size = VALUE_SIZE[valueSize ?? (layout === "icon-first" ? "md" : "lg")];
  const showIcon = enableIcon && icon;
  const showBadge = !labelFirst && enableBadge && badge;
  const showFooter = enableFooter && (footerLeft || footerRight);
  const showProgress = enableProgress && progress !== undefined;
  const gradient = enableGradient ?? !labelFirst;
  const hover = enableHover ?? !labelFirst;
  const divider = enableDivider ?? !labelFirst;

  if (layout === "tinted") {
    const vertical = orientation === "vertical";
    const tinted = classes.tinted;
    return (
      <div
        className={cn(
          "flex gap-3 rounded-2xl border p-4 shadow-xs transition-all",
          vertical ? "flex-col items-center text-center" : "items-center",
          tinted.card,
          (enableHover ?? false) && "hover:shadow-md",
          className
        )}
      >
        {showIcon ? (
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-xs [&_svg]:size-6", tinted.solid)}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <span className={cn("block text-xs font-bold uppercase tracking-wider", tinted.label)}>{label}</span>
          {value !== undefined ? (
            <p className={cn("font-black", size, tinted.value)}>
              {value}
              {unit ? <span className="ml-1.5">{unit}</span> : null}
            </p>
          ) : null}
          {enableFooter && footerLeft ? (
            <p className={cn("font-medium", value === undefined ? "mt-0.5 text-xs font-semibold" : "truncate text-[11px]", value === undefined ? tinted.label : tinted.note)}>
              {footerLeft}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const iconNode = showIcon ? (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border shadow-2xs [&_svg]:size-5",
        labelFirst ? "h-8 w-8 rounded-lg [&_svg]:size-4" : "h-10 w-10 rounded-xl",
        classes.icon
      )}
    >
      {icon}
    </div>
  ) : null;

  const labelNode = (
    <p
      className={cn(
        labelFirst ? cn("text-xs font-bold uppercase", classes.label) : "text-xs font-medium text-muted-foreground"
      )}
    >
      {label}
    </p>
  );

  const valueNode = value === undefined ? null : (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-bold tracking-tight",
          labelFirst ? "font-extrabold" : "font-mono",
          size,
          colorValue ? classes.value : "text-foreground"
        )}
      >
        {value}
      </span>
      {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
    </div>
  );

  const progressNode = showProgress ? (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
    >
      <div
        className={cn("h-full rounded-full transition-all", classes.bar)}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-card shadow-xs transition-all dark:border-slate-800",
        labelFirst ? "space-y-1 p-4" : "space-y-4 p-5",
        gradient && cn("bg-gradient-to-br from-card via-card", classes.gradient),
        hover && "hover:shadow-md",
        className
      )}
    >
      {labelFirst ? (
        <>
          <div className="flex items-center justify-between gap-2">
            {labelNode}
            {iconNode}
          </div>
          <div>
            {valueNode}
            {progressNode}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {iconNode}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">{labelNode}</div>
                {showBadge ? (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold [&_svg]:size-3",
                      classes.pill,
                      badgeMono && "font-mono"
                    )}
                  >
                    {badgeIcon}
                    {badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-1">{valueNode}</div>
              {progressNode}
            </div>
          </div>
        </>
      )}

      {showFooter ? (
        <div
          className={cn(
            "flex items-center justify-between text-[11px] text-muted-foreground",
            divider ? "border-t border-slate-100 pt-2 dark:border-slate-800/80" : labelFirst ? "pt-0.5" : "pt-2"
          )}
        >
          <span>{footerLeft}</span>
          <span className={cn(labelFirst ? "text-muted-foreground" : "font-semibold text-foreground")}>{footerRight}</span>
        </div>
      ) : null}
    </div>
  );
}
