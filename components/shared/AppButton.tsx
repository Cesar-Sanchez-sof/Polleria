import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "success";
export type AppButtonSize = "sm" | "md" | "lg";
export type AppButtonRounded = "lg" | "xl" | "full";

export interface AppButtonProps {
  children?: ReactNode;
  /** Icon drawn next to the text (e.g. the "+" of "Nuevo Proveedor"). */
  icon?: ReactNode;
  /** Side of the icon. Default: "start". */
  iconPosition?: "start" | "end";
  /** primary = main action (accent red), secondary = outlined, soft = tinted, ghost = no background. */
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  rounded?: AppButtonRounded;
  /** Shows a spinner and blocks clicks. */
  loading?: boolean;
  disabled?: boolean;
  /** Takes the full width of its container. Default: false. */
  fullWidth?: boolean;
  /** Shows the icon. Default: true. */
  enableIcon?: boolean;
  /** Adds the soft shadow of the primary toolbar buttons. Default: true for primary. */
  enableShadow?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLElement>;
  /** Required when the button has only an icon. */
  ariaLabel?: string;
  className?: string;
}

const VARIANTS: Record<AppButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
  secondary: "bg-background text-foreground border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
  soft: "bg-primary/10 text-primary border-transparent hover:bg-primary/20",
  ghost: "bg-transparent text-foreground border-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white border-transparent hover:bg-rose-700",
  success: "bg-emerald-600 text-white border-transparent hover:bg-emerald-700",
};

const SIZES: Record<AppButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-xs",
  lg: "h-11 px-5 text-sm",
};

const ROUNDED: Record<AppButtonRounded, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

/**
 * Standard button of the ERP. The main action of a toolbar ("+ Nuevo Proveedor") is the
 * `primary` variant; the other variants cover secondary, tinted, borderless and status actions.
 */
export function AppButton({
  children,
  icon,
  iconPosition = "start",
  variant = "primary",
  size = "md",
  rounded = "xl",
  loading = false,
  disabled = false,
  fullWidth = false,
  enableIcon = true,
  enableShadow,
  href,
  type = "button",
  onClick,
  ariaLabel,
  className,
}: Readonly<AppButtonProps>) {
  const shadow = enableShadow ?? variant === "primary";
  const isDisabled = disabled || loading;
  const iconOnly = !children;
  const showIcon = enableIcon && icon && !loading;

  const classes = cn(
    "inline-flex cursor-pointer select-none items-center justify-center gap-1.5 border font-semibold transition-all [&_svg]:size-4 [&_svg]:shrink-0",
    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    ROUNDED[rounded],
    iconOnly && "aspect-square px-0",
    fullWidth && "w-full",
    shadow && "shadow-xs",
    className
  );

  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" /> : null}
      {showIcon && iconPosition === "start" ? icon : null}
      {children ? <span>{children}</span> : null}
      {showIcon && iconPosition === "end" ? icon : null}
    </>
  );

  if (href && !isDisabled) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} disabled={isDisabled} aria-label={ariaLabel} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
