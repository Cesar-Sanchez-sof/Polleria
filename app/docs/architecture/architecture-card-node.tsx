'use client';

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Monitor,
  Smartphone,
  ChefHat,
  LayoutDashboard,
  Printer,
  Globe,
  Server,
  KeyRound,
  ShoppingBag,
  Boxes,
  Truck,
  BookOpen,
  Users,
  ShieldCheck,
  Settings,
  PlugZap,
  Brain,
  Bot,
  Database,
  Lock,
  FileText,
  CreditCard,
  Cloud,
  ChevronRight,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ArchitectureNodeData } from './architecture-data';

const ICON_MAP: Record<string, LucideIcon> = {
  Monitor,
  Smartphone,
  ChefHat,
  LayoutDashboard,
  Printer,
  Globe,
  Server,
  KeyRound,
  ShoppingBag,
  Boxes,
  Truck,
  BookOpen,
  Users,
  ShieldCheck,
  Settings,
  PlugZap,
  Brain,
  Bot,
  Database,
  Lock,
  FileText,
  CreditCard,
  Cloud,
};

export function ArchitectureCardNode({ data, selected }: Readonly<NodeProps>) {
  const nodeData = data as unknown as ArchitectureNodeData;
  const IconComponent = (nodeData.iconName && ICON_MAP[nodeData.iconName]) || Server;

  return (
    <div
      className={`group relative w-[320px] rounded-xl border bg-card text-card-foreground shadow-md transition-all duration-200 select-none ${
        selected
          ? 'ring-2 ring-primary border-primary shadow-lg scale-[1.02]'
          : 'hover:border-foreground/40 hover:shadow-lg'
      }`}
      style={{
        borderTopWidth: 4,
        borderTopColor: nodeData.color,
      }}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} id="top" className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !bg-primary !border-2 !border-background" />

      {/* Header */}
      <div className="p-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-xs"
              style={{
                backgroundColor: `${nodeData.color}18`,
                color: nodeData.color,
                border: `1px solid ${nodeData.color}35`,
              }}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground truncate">
                {nodeData.title}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {nodeData.subtitle}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${nodeData.color}15`,
              color: nodeData.color,
              border: `1px solid ${nodeData.color}30`,
            }}
          >
            {nodeData.tier}
          </span>
        </div>

        {/* Tech tags */}
        {nodeData.technologies && nodeData.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 mb-2">
            {nodeData.technologies.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tech}
              </span>
            ))}
            {nodeData.technologies.length > 3 && (
              <span className="rounded-md bg-muted/60 px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
                +{nodeData.technologies.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Responsibilities */}
      <div className="border-t border-border/60 bg-muted/20 px-3.5 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Responsabilidades clave:
        </p>
        <ul className="space-y-1">
          {nodeData.responsibilities.slice(0, 3).map((item, idx) => (
            <li key={idx} className="flex items-start gap-1.5 text-xs text-foreground/80 leading-tight">
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
              <span className="line-clamp-1">{item}</span>
            </li>
          ))}
        </ul>

        {/* Arch rule badge if present */}
        {nodeData.rules && nodeData.rules.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 rounded px-1.5 py-0.5">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span className="truncate">{nodeData.rules[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
