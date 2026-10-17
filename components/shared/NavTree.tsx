"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTreeSize = "sm" | "md";
export type NavTreeMatch = "exact" | "prefix";
export type NavTreeDefaultOpen = "active" | "all" | "none";

export interface NavTreeNode {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Leaf destination. Without `href`, a leaf calls `onSelect`. */
  href?: string;
  /** Child nodes: the node becomes a collapsible group. */
  children?: readonly NavTreeNode[];
  /** Small text at the end of a leaf (count, "Nuevo"...). */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface NavTreeProps {
  nodes: readonly NavTreeNode[];
  /** Key of the active leaf. When omitted it is derived from the current route and `href`. */
  activeKey?: string;
  /** How the route is matched against `href` when `activeKey` is not given. Default: "exact". */
  matchMode?: NavTreeMatch;
  /** Called when a leaf without `href` (or with `href`, after navigating) is chosen. */
  onSelect?: (node: NavTreeNode) => void;
  /** Groups that start open: the one with the active leaf, all, or none. Default: "active". */
  defaultOpen?: NavTreeDefaultOpen;
  /** Keeps a single group open at a time. Default: false. */
  accordion?: boolean;
  /** Shows the icons of the nodes. Default: true. */
  enableIcons?: boolean;
  /** Shows the vertical guide line next to the children. Default: true. */
  enableGuide?: boolean;
  /** Shows the badge of the leaves. Default: true. */
  enableBadges?: boolean;
  /** Allows collapsing the groups. When false every group is always open. Default: true. */
  collapsible?: boolean;
  size?: NavTreeSize;
  /** Color of the active item. Default: "red" (app brand). */
  activeTone?: "red" | "blue";
  className?: string;
  ariaLabel?: string;
}

const SIZE: Record<NavTreeSize, { row: string; child: string; icon: string }> = {
  sm: { row: "px-2.5 py-1.5 text-xs", child: "px-2.5 py-1 text-xs", icon: "[&_svg]:h-3.5 [&_svg]:w-3.5" },
  md: { row: "px-3 py-2 text-sm", child: "px-3 py-1.5 text-sm", icon: "[&_svg]:h-4 [&_svg]:w-4" },
};

function leafActive(node: NavTreeNode, pathname: string, activeKey: string | undefined, match: NavTreeMatch): boolean {
  if (activeKey !== undefined) return node.key === activeKey;
  if (!node.href) return false;
  return match === "exact" ? pathname === node.href : pathname === node.href || pathname.startsWith(`${node.href}/`);
}

function containsActive(node: NavTreeNode, pathname: string, activeKey: string | undefined, match: NavTreeMatch): boolean {
  if (!node.children) return leafActive(node, pathname, activeKey, match);
  return node.children.some((child) => containsActive(child, pathname, activeKey, match));
}

/**
 * Collapsible navigation tree (the inner menu of the style guide): groups with icon and chevron,
 * leaves with the active one highlighted, optional guide line, badges and accordion behaviour.
 */
export function NavTree({
  nodes,
  activeKey,
  matchMode = "exact",
  onSelect,
  defaultOpen = "active",
  accordion = false,
  enableIcons = true,
  enableGuide = true,
  enableBadges = true,
  collapsible = true,
  size = "md",
  activeTone = "red",
  className,
  ariaLabel,
}: Readonly<NavTreeProps>) {
  const pathname = usePathname() ?? "";
  const sizes = SIZE[size];

  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of nodes) {
      if (!node.children) continue;
      if (defaultOpen === "all" || (defaultOpen === "active" && containsActive(node, pathname, activeKey, matchMode))) {
        initial.add(node.key);
      }
    }
    return initial;
  });

  // Navigating to another section opens the group that now holds the active leaf
  // (state adjusted while rendering, the recommended pattern for state derived from props).
  const signature = `${pathname}|${activeKey ?? ""}`;
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setSyncedSignature(signature);
    if (defaultOpen !== "none") {
      const next = new Set(accordion ? [] : open);
      for (const node of nodes) {
        if (node.children && containsActive(node, pathname, activeKey, matchMode)) next.add(node.key);
      }
      setOpen(next);
    }
  }

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(accordion ? [] : current);
      if (current.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderLeaf = (node: NavTreeNode, nested: boolean) => {
    const active = leafActive(node, pathname, activeKey, matchMode);
    const classes = cn(
      "flex w-full items-center gap-3 rounded-lg text-left transition-colors",
      nested ? sizes.child : sizes.row,
      active
        ? activeTone === "blue"
          ? "bg-blue-50 font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          : "bg-red-50 font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300"
        : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800",
      node.disabled && "pointer-events-none opacity-50"
    );
    const content = (
      <>
        {enableIcons && node.icon ? <span className={cn("shrink-0", sizes.icon)}>{node.icon}</span> : null}
        <span className="flex-1 truncate">{node.label}</span>
        {enableBadges && node.badge ? (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {node.badge}
          </span>
        ) : null}
      </>
    );

    return node.href ? (
      <Link href={node.href} aria-current={active ? "page" : undefined} className={classes} onClick={() => onSelect?.(node)}>
        {content}
      </Link>
    ) : (
      <button type="button" aria-current={active ? "page" : undefined} className={classes} onClick={() => onSelect?.(node)}>
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={ariaLabel} className={cn("space-y-1", className)}>
      {nodes.map((node) => {
        if (!node.children) return <div key={node.key}>{renderLeaf(node, false)}</div>;

        const isOpen = !collapsible || open.has(node.key);
        return (
          <div key={node.key}>
            <button
              type="button"
              aria-expanded={isOpen}
              disabled={!collapsible}
              onClick={() => toggle(node.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800",
                collapsible ? "cursor-pointer" : "cursor-default",
                sizes.row
              )}
            >
              {enableIcons && node.icon ? <span className={cn("shrink-0", sizes.icon)}>{node.icon}</span> : null}
              <span className="flex-1 text-left">{node.label}</span>
              {collapsible ? (
                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
              ) : null}
            </button>
            {isOpen ? (
              <ul className={cn("ml-5 mt-1 space-y-0.5 pl-3", enableGuide && "border-l border-slate-200 dark:border-slate-800")}>
                {node.children.map((child) => (
                  <li key={child.key}>{renderLeaf(child, true)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
