'use client';

import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Truck,
  Boxes,
  BookOpen,
  Users,
  ShieldCheck,
  Brain,
  ArrowRight,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { LIFECYCLE_FLOWS, type FlowLifecycle } from './architecture-data';

const FLOW_ICONS: Record<string, React.ElementType> = {
  'sales-lifecycle': UtensilsCrossed,
  'purchases-lifecycle': Truck,
  'inventory-lifecycle': Boxes,
  'accounting-lifecycle': BookOpen,
  'hr-lifecycle': Users,
  'security-lifecycle': ShieldCheck,
  'ai-lifecycle': Brain,
};

export function ArchitectureSequence() {
  const [activeFlowId, setActiveFlowId] = useState<string>(LIFECYCLE_FLOWS[0].id);

  const activeFlow =
    LIFECYCLE_FLOWS.find((f) => f.id === activeFlowId) ?? LIFECYCLE_FLOWS[0];
  const IconComponent = FLOW_ICONS[activeFlow.id] || Layers;

  return (
    <div className="flex h-full flex-col gap-4 p-4 overflow-y-auto">
      {/* Selector of 7 End-to-End Lifecycles */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-3">
          <h2 className="text-base font-bold text-foreground">
            Flujos de Arquitectura por Dominio de Negocio
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecciona un ciclo operativo para observar cómo viaja la petición a través de las 3 capas, servicios satélites y bases de datos.
          </p>
        </div>

        {/* Tab buttons for all 7 lifecycles */}
        <div className="flex flex-wrap items-center gap-2">
          {LIFECYCLE_FLOWS.map((flow) => {
            const isCurrent = activeFlowId === flow.id;
            const FlowIcon = FLOW_ICONS[flow.id] || Layers;

            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => setActiveFlowId(flow.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                  isCurrent
                    ? 'shadow-xs ring-1'
                    : 'bg-muted/40 hover:bg-muted text-foreground/80'
                }`}
                style={{
                  backgroundColor: isCurrent ? `${flow.color}15` : undefined,
                  borderColor: isCurrent ? flow.color : 'transparent',
                  color: isCurrent ? flow.color : undefined,
                }}
              >
                <FlowIcon className="h-4 w-4 shrink-0" />
                <span>{flow.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Flow Details Banner */}
      <div
        className="rounded-xl border p-4 shadow-xs"
        style={{
          borderColor: `${activeFlow.color}35`,
          backgroundColor: `${activeFlow.color}08`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-xs"
            style={{ backgroundColor: activeFlow.color, color: '#ffffff' }}
          >
            <IconComponent className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {activeFlow.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeFlow.description}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Timeline for Selected Module */}
      <div className="flex flex-col gap-3 pb-8">
        {activeFlow.steps.map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-xs hover:border-foreground/30 transition-all"
          >
            {/* Step badge */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-xs text-white"
              style={{ backgroundColor: activeFlow.color }}
            >
              {String(item.step).padStart(2, '0')}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>{item.actor}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span style={{ color: activeFlow.color }}>{item.action}</span>
                </h4>

                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground">
                  {item.protocol}
                </span>
              </div>

              <p className="mt-1 text-xs text-foreground/80 leading-relaxed">
                {item.description}
              </p>

              <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/70">Capa / Servicio:</span>
                <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                  {item.target}
                </code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
