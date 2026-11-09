'use client';

import React, { useMemo, useState, useCallback } from 'react';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type InternalNode,
} from '@xyflow/react';
import {
  Download,
  Filter,
  Search,
  X,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  RotateCcw,
  Boxes,
  Lock,
} from 'lucide-react';
import {
  ARCHITECTURE_NODES,
  ARCHITECTURE_EDGES,
  ARCHITECTURE_LAYERS,
  TIER_CONTAINERS,
  MODULE_FILTERS,
  type ArchitectureNodeData,
  type ArchitectureTier,
  type FunctionalModule,
} from './architecture-data';
import { ArchitectureCardNode } from './architecture-card-node';
import { TierGroupNode } from './tier-group-node';
import { downloadArchitectureSvg } from './export-architecture-svg';

const nodeTypes = {
  architectureCard: ArchitectureCardNode,
  tierGroup: TierGroupNode,
};

function buildInitialNodes(): Node[] {
  // 1. Container/Group nodes (render as background frames matching Mermaid subgraphs)
  const groupNodes: Node[] = TIER_CONTAINERS.map((group) => ({
    id: group.id,
    type: 'tierGroup',
    position: { x: group.x, y: group.y },
    data: {
      title: group.title,
      subtitle: group.subtitle,
      badge: group.badge,
      color: group.color,
      width: group.width,
      height: group.height,
    },
    draggable: false,
    selectable: false,
    zIndex: -1,
  }));

  // 2. Component Card nodes positioned neatly inside their respective container
  const cardPositions: Record<string, { x: number; y: number }> = {
    // --- CAPA 1: PRESENTACIÓN / FRONTEND (y: 60) ---
    'front-sales': { x: 25, y: 60 },
    'front-mozo': { x: 395, y: 60 },
    'front-kitchen': { x: 765, y: 60 },
    'front-purchases': { x: 1135, y: 60 },
    'front-inventory': { x: 1505, y: 60 },
    'front-accounting': { x: 1875, y: 60 },
    'front-hr': { x: 2245, y: 60 },
    'front-security': { x: 2615, y: 60 },

    // --- CAPA 2: TRANSPORTE HTTP & SEGURIDAD (y: 380) ---
    'api-gateway': { x: 160, y: 380 },
    'auth-security': { x: 880, y: 380 },
    'zod-error-handler': { x: 1600, y: 380 },
    'eslint-enforcement': { x: 2320, y: 380 },

    // --- CAPA 3: SERVICIOS DE DOMINIO DDD (y: 700) ---
    'domain-sales': { x: 25, y: 700 },
    'domain-purchases': { x: 395, y: 700 },
    'domain-inventory': { x: 765, y: 700 },
    'domain-accounting': { x: 1135, y: 700 },
    'domain-hr': { x: 1505, y: 700 },
    'domain-security': { x: 1875, y: 700 },
    'domain-settings': { x: 2245, y: 700 },
    'domain-integrations': { x: 2615, y: 700 },

    // --- CAPA 4: MICROSERVICIOS IA ASISTENTE (y: 1020) ---
    'ai-service': { x: 30, y: 1020 },
    'agents-service': { x: 390, y: 1020 },
    'ai-readonly-db': { x: 750, y: 1020 },

    // --- CAPA 5: PERSISTENCIA (@/lib/prisma) (y: 1020) ---
    'prisma-orm': { x: 1450, y: 1020 },
    'neon-postgres': { x: 2150, y: 1020 },

    // --- CAPA 6: SERVICIOS EXTERNOS & CLOUD (y: 1340) ---
    'hardware-escpos': { x: 80, y: 1340 },
    'ext-payments': { x: 680, y: 1340 },
    'ext-sunat': { x: 1280, y: 1340 },
    'ext-s3': { x: 1880, y: 1340 },
    'ext-reniec': { x: 2480, y: 1340 },
  };

  const cardNodes: Node[] = ARCHITECTURE_NODES.map((item) => ({
    id: item.id,
    type: 'architectureCard',
    position: cardPositions[item.id] ?? { x: 100, y: 100 },
    data: item as unknown as Record<string, unknown>,
    draggable: false, // Disallow dragging to keep diagram layout static
    zIndex: 10,
  }));

  return [...groupNodes, ...cardNodes];
}

function buildInitialEdges(): Edge[] {
  return ARCHITECTURE_EDGES.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.animated ?? false,
    style: {
      stroke: 'var(--color-primary, #6366f1)',
      strokeWidth: 1.6,
      opacity: 0.75,
      ...edge.style,
    },
  }));
}

function DiagramActions({ onResetView }: { onResetView: () => void }) {
  const { getNodes, getEdges, getInternalNode, fitView } = useReactFlow();

  const handleExportSvg = () => {
    const nodes = getNodes()
      .map((n) => getInternalNode(n.id))
      .filter((n): n is InternalNode => !!n);
    downloadArchitectureSvg(nodes, getEdges());
  };

  return (
    <Panel position="top-left" className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExportSvg}
        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
        title="Descargar diagrama en formato vectorial SVG de alta calidad"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Descargar SVG (Alta Calidad)</span>
      </button>

      <button
        type="button"
        onClick={() => {
          fitView({ padding: 0.08, duration: 600 });
          onResetView();
        }}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted transition-colors cursor-pointer"
        title="Centrar y reajustar vista"
      >
        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
        Ajustar Vista
      </button>

      <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hidden sm:flex">
        <Lock className="h-3 w-3 text-amber-500" />
        <span>Posición Fija (Solo Zoom & Desplazamiento)</span>
      </div>
    </Panel>
  );
}

export function ArchitectureDiagram() {
  const initialNodes = useMemo(() => buildInitialNodes(), []);
  const initialEdges = useMemo(() => buildInitialEdges(), []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState<ArchitectureNodeData | null>(null);
  const [activeTier, setActiveTier] = useState<ArchitectureTier | 'all'>('all');
  const [activeModule, setActiveModule] = useState<FunctionalModule>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Node selection handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'tierGroup') return;
    setSelectedNode(node.data as unknown as ArchitectureNodeData);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Filtered nodes according to tier, module and search
  const visibleNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return nodes.map((node) => {
      if (node.type === 'tierGroup') {
        return node; // Group containers remain visible to keep structure
      }

      const data = node.data as unknown as ArchitectureNodeData;
      const matchesTier = activeTier === 'all' || data.tier === activeTier;
      const matchesModule =
        activeModule === 'all' ||
        data.module === activeModule ||
        data.tier === 'persistence' ||
        data.id === 'api-gateway';

      const matchesSearch =
        !q ||
        data.title.toLowerCase().includes(q) ||
        data.subtitle.toLowerCase().includes(q) ||
        data.responsibilities.some((r) => r.toLowerCase().includes(q)) ||
        data.technologies.some((t) => t.toLowerCase().includes(q));

      const isDimmed = !matchesTier || !matchesModule || !matchesSearch;

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isDimmed ? 0.15 : 1,
          transition: 'opacity 0.25s ease',
        },
      };
    });
  }, [nodes, activeTier, activeModule, searchQuery]);

  return (
    <div className="flex h-full flex-col gap-3 p-4" data-slot="diagram-container">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-2.5 bg-card border border-border rounded-xl p-3 shadow-xs">
        {/* Module Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-foreground mr-1 flex items-center gap-1">
              <Boxes className="h-3.5 w-3.5 text-primary" /> Módulo:
            </span>
            {MODULE_FILTERS.map((mod) => {
              const isSelected = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveModule(mod.id)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'shadow-xs ring-1'
                      : 'bg-muted/40 hover:bg-muted text-foreground/80'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${mod.color}18` : undefined,
                    borderColor: isSelected ? mod.color : 'transparent',
                    color: isSelected ? mod.color : undefined,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: mod.color }}
                  />
                  {mod.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar: Kardex, SUNAT, S3, RRHH..."
              className="w-full rounded-lg border border-border bg-background pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tier Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Capa:
          </span>
          <button
            type="button"
            onClick={() => setActiveTier('all')}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTier === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted'
            }`}
          >
            Todas las Capas
          </button>
          {Object.values(ARCHITECTURE_LAYERS).map((layer) => {
            const isActive = activeTier === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveTier(layer.id)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'shadow-xs ring-1'
                    : 'bg-muted/40 hover:bg-muted/80 text-foreground/80'
                }`}
                style={{
                  backgroundColor: isActive ? `${layer.color}15` : undefined,
                  borderColor: layer.color,
                  color: isActive ? layer.color : undefined,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
                {layer.badge}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Flow Canvas & Inspector */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <ReactFlowProvider>
          <ReactFlow
            nodes={visibleNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            minZoom={0.08}
            maxZoom={1.8}
            nodesDraggable={false} /* Strictly static layout requested by user */
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            proOptions={{ hideAttribution: true }}
            aria-label="Diagrama estático e integral de arquitectura de alto nivel"
          >
            <Background gap={24} size={1.2} color="var(--color-border, #cbd5e1)" />
            <DiagramActions onResetView={() => setSelectedNode(null)} />

            {/* Controls for zoom in, zoom out and fit view */}
            <Controls
              position="bottom-right"
              showInteractive={false}
              className="!border !border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-muted"
            />

            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              bgColor="var(--color-card, #ffffff)"
              maskColor="rgba(0, 0, 0, 0.4)"
              nodeColor={(n) => {
                if (n.type === 'tierGroup') return '#cbd5e1';
                return (n.data as unknown as ArchitectureNodeData)?.color || '#6366f1';
              }}
              className="!border !border-border !rounded-lg !shadow-sm !overflow-hidden"
              style={{ width: 170, height: 105 }}
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Node Inspection Sidebar / Drawer */}
        {selectedNode && (
          <aside className="absolute right-4 top-4 bottom-4 w-96 max-w-[calc(100%-2rem)] z-20 flex flex-col rounded-xl border border-border bg-card/95 backdrop-blur-md p-5 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {ARCHITECTURE_LAYERS[selectedNode.tier]?.name || selectedNode.tier}
                  </span>
                  <h4 className="text-base font-bold text-foreground leading-tight">
                    {selectedNode.title}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Path */}
            {selectedNode.path && (
              <div className="mt-3 flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-mono text-muted-foreground">
                <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{selectedNode.path}</span>
              </div>
            )}

            {/* Technologies */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tecnologías y Estándares
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Protocols */}
            {selectedNode.protocols && selectedNode.protocols.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Protocolos & Comunicación
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.protocols.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-medium text-primary"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Responsibilities */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Responsabilidades del Componente
              </p>
              <ul className="space-y-2">
                {selectedNode.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Architecture Rules from AGENTS.md */}
            {selectedNode.rules && selectedNode.rules.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Reglas de Gobernanza (AGENTS.md)
                </div>
                <ul className="space-y-1">
                  {selectedNode.rules.map((rule, idx) => (
                    <li key={idx} className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                      • {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
