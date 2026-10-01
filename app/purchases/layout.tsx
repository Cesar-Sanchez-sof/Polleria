import React from "react";
import Sidebar from "@/components/personalized/Sidebar";

export const metadata = {
  title: "Purchases & Inventory Module | Pollería ERP",
};

export default function PurchasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background text-sm text-foreground min-h-screen">
      {/* Fixed sidebar on the left */}
      <Sidebar />

      {/* Main area on the right with padding to offset fixed Sidebar (w-64 = 16rem = pl-64) */}
      <div className="pl-64 min-h-screen flex flex-col w-full overflow-x-hidden">
        <main className="relative flex-1 w-full min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
