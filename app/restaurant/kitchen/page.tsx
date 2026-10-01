"use client";

import { ChefHat } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { KitchenBoard } from "@/components/restaurant/KitchenBoard";

export default function KitchenPage() {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-surface w-full min-w-0 overflow-x-hidden">
      <ModuleHeader
        title="Cocina (KDS)"
        subtitle="Control de preparación y despacho de comandas"
        icon={ChefHat}
        iconClassName="bg-amber-100 text-amber-800"
      />
      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6">
        <KitchenBoard />
      </main>
    </div>
  );
}
