"use client";

import type { ReactNode } from "react";
import { Home, LayoutGrid, MousePointerClick, Navigation, Palette } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { NavTree, type NavTreeNode } from "@/components/shared/NavTree";
import { entryHref, STYLE_GUIDE_CATEGORIES } from "@/components/style-guide/registry";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, ReactNode> = {
  visualization: <LayoutGrid />,
  navigation: <Navigation />,
  inputs: <MousePointerClick />,
};

/** Tree of the style guide built from the registry: "Inicio" plus one group per category. */
const TREE_NODES: readonly NavTreeNode[] = [
  { key: "home", label: "Inicio", icon: <Home />, href: "/style-guide" },
  ...STYLE_GUIDE_CATEGORIES.map<NavTreeNode>((category) => ({
    key: category.key,
    label: category.label,
    icon: CATEGORY_ICONS[category.key] ?? <Palette />,
    children: category.entries.map((entry) => ({
      key: `${category.key}/${entry.slug}`,
      label: entry.title,
      href: entryHref(category.key, entry.slug),
    })),
  })),
];

/** Style guide shell: inner navigation tree on the left, the selected page on the right. */
export default function StyleGuideLayout({ children }: Readonly<{ children: ReactNode }>) {

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ModuleHeader
        title="Guía de estilos"
        subtitle="Componentes reutilizables y sus parámetros"
        icon={Palette}
        iconClassName="bg-violet-100 text-violet-700"
      />
      <div className="flex w-full px-6 py-6">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 pr-3 md:block dark:border-slate-800">
          <NavTree
            nodes={TREE_NODES}
            ariaLabel="Guía de estilos"
            className={cn("sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto")}
          />
        </aside>
        <main className="min-w-0 flex-1 pl-4 pr-2 sm:pl-6">{children}</main>
      </div>
    </div>
  );
}
