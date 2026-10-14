"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/personalized/Sidebar";
import { GuardaRuta } from "@/components/personalized/GuardaRuta";
import { PermisosProvider } from "@/components/personalized/PermisosProvider";

interface AppLayoutShellProps {
  children: React.ReactNode;
}

export function AppLayoutShell({ children }: AppLayoutShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return (
      <main className="w-full min-w-full min-h-screen flex flex-col bg-background p-0 m-0 overflow-x-hidden">
        {children}
      </main>
    );
  }

  return (
    <PermisosProvider>
      <div className="w-full min-w-full flex bg-background text-sm text-foreground antialiased min-h-screen overflow-x-hidden">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <div className="flex-1 w-full min-w-0">
          <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
            <GuardaRuta>{children}</GuardaRuta>
          </div>
        </div>
      </div>
    </PermisosProvider>
  );
}