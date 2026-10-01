import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ModuleHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon container (background + icon color). */
  iconClassName?: string;
  children?: ReactNode;
}

/**
 * Sticky top header shared across restaurant, accounting and purchases modules.
 */
export function ModuleHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName = "bg-red-100 text-red-700",
  children,
}: Readonly<ModuleHeaderProps>) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 pl-12 pr-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight truncate">{title}</h1>
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        </div>
      </div>

      {children ? <div className="flex items-center gap-3 shrink-0">{children}</div> : null}
    </header>
  );
}

/** @deprecated Prefer ModuleHeader */
export const RestaurantHeader = ModuleHeader;
