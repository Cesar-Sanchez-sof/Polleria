import React from "react";
import Sidebar from "@/components/personalized/Sidebar";

export const metadata = {
  title: "Módulo de Compras & Inventario | Pollería ERP",
};

export default function ComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background text-sm text-foreground min-h-screen">
      {/* Sidebar fijo a la izquierda */}
      <Sidebar />

      {/* Area principal a la derecha con margen para compensar Sidebar fijo (w-64 = 16rem = pl-64) */}
      <div className="pl-64 min-h-screen flex flex-col w-full overflow-x-hidden">
        <main className="relative flex-1 w-full min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
