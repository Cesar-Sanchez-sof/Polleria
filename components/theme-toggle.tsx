"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const OPTIONS: Array<{ value: ThemeValue; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema oscuro", icon: Moon },
  { value: "system", label: "Tema del sistema", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-surface-container-low rounded-full p-1 gap-1 mx-space-sm",
        className,
      )}
      role="group"
      aria-label="Selector de tema"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex-1 py-1 flex items-center justify-center rounded-full transition-colors cursor-pointer",
              isActive
                ? "bg-surface-container-lowest text-primary-container shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
