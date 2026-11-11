'use client';

import React from 'react';
import type { NodeProps } from '@xyflow/react';

interface TierGroupData {
  title: string;
  subtitle: string;
  color: string;
  width: number;
  height: number;
  badge?: string;
  [key: string]: unknown;
}

export function TierGroupNode({ data }: Readonly<NodeProps>) {
  const groupData = data as unknown as TierGroupData;

  return (
    <div
      className="relative rounded-2xl border-2 border-dashed pointer-events-none select-none transition-all shadow-xs"
      style={{
        width: groupData.width,
        height: groupData.height,
        borderColor: `${groupData.color}55`,
        backgroundColor: `${groupData.color}08`,
      }}
    >
      {/* Header bar inside the container */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{
          borderColor: `${groupData.color}30`,
          backgroundColor: `${groupData.color}12`,
          borderTopLeftRadius: '0.875rem',
          borderTopRightRadius: '0.875rem',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full shadow-xs"
            style={{ backgroundColor: groupData.color }}
          />
          <h2
            className="text-xs font-black tracking-wider uppercase"
            style={{ color: groupData.color }}
          >
            {groupData.title}
          </h2>
          {groupData.badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${groupData.color}25`,
                color: groupData.color,
              }}
            >
              {groupData.badge}
            </span>
          )}
        </div>

        <p className="text-[11px] font-medium text-muted-foreground hidden md:block">
          {groupData.subtitle}
        </p>
      </div>
    </div>
  );
}
