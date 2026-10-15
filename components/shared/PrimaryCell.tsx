import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type PrimaryCellTone = "blue" | "emerald" | "indigo" | "amber" | "rose" | "neutral";
export type PrimaryCellTitleStyle = "default" | "link";

export interface PrimaryCellProps {
  /** Main text of the cell (supplier name, entry code...). */
  title: ReactNode;
  /** Second line under the title (RUC, reference...). */
  subtitle?: ReactNode;
  /** Icon drawn inside the colored square before the text. */
  icon?: ReactNode;
  iconTone?: PrimaryCellTone;
  /** Makes the title clickable (button). Ignored when `href` is set. */
  onClick?: () => void;
  /** Makes the title a link. */
  href?: string;
  /** Opens `href` in a new tab. Default: false. */
  newTab?: boolean;
  /** "link" paints the title in the accent color (red) like a clickable code. Default: "default", or "link" when clickable. */
  titleStyle?: PrimaryCellTitleStyle;
  /** Shows the external-link icon after a clickable title. Default: false. */
  showLinkIcon?: boolean;
  /** Shows the icon square. Default: true. */
  enableIcon?: boolean;
  /** Shows the subtitle. Default: true. */
  enableSubtitle?: boolean;
  /** Writes the subtitle in monospace. Default: true. */
  subtitleMono?: boolean;
  /** Writes the title in monospace (codes). Default: false. */
  titleMono?: boolean;
  /** Truncates long texts with an ellipsis. Default: true. */
  truncate?: boolean;
  className?: string;
}

const ICON_TONES: Record<PrimaryCellTone, string> = {
  blue: "bg-blue-50/80 text-blue-600 border-blue-100/70 dark:bg-blue-950/50 dark:text-blue-400",
  emerald: "bg-emerald-50/80 text-emerald-600 border-emerald-100/70 dark:bg-emerald-950/50 dark:text-emerald-400",
  indigo: "bg-indigo-50/80 text-indigo-600 border-indigo-100/70 dark:bg-indigo-950/50 dark:text-indigo-400",
  amber: "bg-amber-50/80 text-amber-600 border-amber-100/70 dark:bg-amber-950/50 dark:text-amber-400",
  rose: "bg-rose-50/80 text-rose-600 border-rose-100/70 dark:bg-rose-950/50 dark:text-rose-400",
  neutral: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

/**
 * Main cell of a table row: optional icon, title (optionally clickable) and optional subtitle.
 * Examples: "Avícola San Fernando / RUC: 20101000000" or the red clickable "MISC/2026/10/0001".
 */
export function PrimaryCell({
  title,
  subtitle,
  icon,
  iconTone = "blue",
  onClick,
  href,
  newTab = false,
  titleStyle,
  showLinkIcon = false,
  enableIcon = true,
  enableSubtitle = true,
  subtitleMono = true,
  titleMono = false,
  truncate = true,
  className,
}: Readonly<PrimaryCellProps>) {
  const clickable = Boolean(href || onClick);
  const style = titleStyle ?? (clickable ? "link" : "default");
  const titleClasses = cn(
    "inline-flex max-w-full items-center gap-1.5 text-xs font-semibold",
    style === "link" ? "text-red-700 dark:text-red-400" : "text-foreground",
    titleMono && "font-mono",
    truncate && "truncate",
    clickable && "cursor-pointer hover:underline"
  );

  const titleContent = (
    <>
      <span className={cn(truncate && "truncate")}>{title}</span>
      {clickable && showLinkIcon ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
    </>
  );

  let titleNode: ReactNode;
  if (href) {
    titleNode = (
      <Link
        href={href}
        className={titleClasses}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {titleContent}
      </Link>
    );
  } else if (onClick) {
    titleNode = (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(titleClasses, "text-left")}
      >
        {titleContent}
      </button>
    );
  } else {
    titleNode = <span className={titleClasses}>{titleContent}</span>;
  }

  const showIcon = enableIcon && icon;
  const showSubtitle = enableSubtitle && subtitle;

  return (
    <div className={cn("flex min-w-0 items-start gap-2.5", className)}>
      {showIcon ? (
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
            ICON_TONES[iconTone]
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        {titleNode}
        {showSubtitle ? (
          <span className={cn("block text-[11px] text-muted-foreground", subtitleMono && "font-mono", truncate && "truncate")}>
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
