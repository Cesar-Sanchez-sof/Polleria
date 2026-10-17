"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { KitchenBoard } from "@/components/restaurant/KitchenBoard";

export default function KitchenPage() {
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  return (
    <>
      <ModuleHeader
        title="Flujo de Cocina (KDS)"
        subtitle="Control de preparación y despacho de comandas"
        icon={ChefHat}
        iconClassName="bg-amber-100 text-amber-800"
      >
        <div ref={setToolbarSlot} className="flex items-center gap-3" />
      </ModuleHeader>
      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6">
        <KitchenBoard toolbarSlot={toolbarSlot} />
      </main>
    </>
  );
}
