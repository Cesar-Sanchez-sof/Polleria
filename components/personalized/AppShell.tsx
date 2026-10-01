import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  /** Extra classes for the outer shell (background, etc.). */
  className?: string;
  /** Extra classes for the main content area. */
  mainClassName?: string;
}

/**
 * Standard full-width page shell: offsets the fixed sidebar on desktop
 * (`md:pl-64`) and stays edge-to-edge on mobile, with responsive padding.
 */
export function AppShell({ children, className, mainClassName }: AppShellProps) {
  return (
    <div
      className={cn(
        "pl-0 md:pl-64 min-h-screen flex flex-col w-full min-w-0 overflow-x-hidden bg-(--color-background)",
        className,
      )}
    >
      <main
        className={cn(
          "relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6",
          mainClassName,
        )}
      >
        <div className="flex flex-col w-full max-w-none gap-5">{children}</div>
      </main>
    </div>
  );
}
