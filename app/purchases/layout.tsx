import React from "react";

export const metadata = {
  title: "Purchases & Inventory Module | Pollería ERP",
};

/**
 * Purchases module layout — full-width content beside the root Sidebar.
 * Does not render a second Sidebar (already provided by the root layout).
 * Children own the sticky ModuleHeader + padded main content.
 */
export default function PurchasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col w-full min-w-0 overflow-x-hidden bg-background text-sm text-foreground">
      {children}
    </div>
  );
}
