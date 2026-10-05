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
    <>
      {children}
    </>
  );
}
