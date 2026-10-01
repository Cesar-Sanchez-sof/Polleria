"use client";

import { Scale } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

export default function Balance() {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
      <ModuleHeader
        title="Balance General"
        subtitle="Estado de situación financiera del periodo"
        icon={Scale}
        iconClassName="bg-slate-900 text-white"
      />
      <main className="relative flex-1 min-h-0 w-full">
        <iframe
          src="/balance.html"
          title="Balance General"
          className="absolute inset-0 w-full h-full border-0"
        />
      </main>
    </div>
  );
}
