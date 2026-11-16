"use client";

import React, { createContext, useContext } from "react";

export const ShareModeContext = createContext<boolean>(false);

export function useShareMode(): boolean {
  return useContext(ShareModeContext);
}

export function ShareModeProvider({
  value = false,
  children,
}: {
  value?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ShareModeContext.Provider value={value}>
      {children}
    </ShareModeContext.Provider>
  );
}
