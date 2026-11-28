"use client";

import { FunnelPlus, FunnelX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdvancedFilterToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function AdvancedFilterToggle({
  open,
  onToggle,
}: Readonly<AdvancedFilterToggleProps>) {
  const label = open ? "Ocultar filtros" : "Activar filtros";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      title={label}
      className="h-9 w-9 rounded-lg border-slate-900 bg-slate-900 p-0 text-white hover:bg-black hover:text-white"
    >
      {open ? <FunnelX className="h-4 w-4" /> : <FunnelPlus className="h-4 w-4" />}
    </Button>
  );
}
