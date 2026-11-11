'use client';

import React, { useState } from 'react';
import { ModuleHeader } from '@/components/shared/ModuleHeader';
import { Layers, Network, Workflow, TableProperties, Code2 } from 'lucide-react';
import { ArchitectureDiagram } from './architecture-diagram';
import { ArchitectureSequence } from './architecture-sequence';
import { ArchitectureSpecTable } from './architecture-spec-table';
import { MermaidView } from './mermaid-view';

type TabView = 'diagram' | 'mermaid' | 'sequence' | 'spec';

export default function ArchitectureDocPage() {
  const [currentTab, setCurrentTab] = useState<TabView>('diagram');

  return (
    <main style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <ModuleHeader
        title="Diagrama de Arquitectura de Alto Nivel"
        subtitle="Visualización integral de capas, flujo de datos, Bounded Contexts DDD y servicios externos."
        icon={Layers}
        iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      >
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border shadow-xs">
          <button
            type="button"
            onClick={() => setCurrentTab('diagram')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'diagram'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Network className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Canvas Interactivo</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('mermaid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'mermaid'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-sky-500" />
            <span className="hidden sm:inline">Diagrama Mermaid</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('sequence')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'sequence'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Workflow className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Flujos de Negocio</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('spec')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'spec'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TableProperties className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Matriz DDD</span>
          </button>
        </div>
      </ModuleHeader>

      <div className="flex-1 overflow-hidden bg-background">
        {currentTab === 'diagram' && <ArchitectureDiagram />}
        {currentTab === 'mermaid' && <MermaidView />}
        {currentTab === 'sequence' && <ArchitectureSequence />}
        {currentTab === 'spec' && <ArchitectureSpecTable />}
      </div>
    </main>
  );
}
