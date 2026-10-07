'use client';

import { DbDiagram } from './db-diagram';

export default function DBDiagramPage() {
  return (
    <main style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <h1 className="text-lg font-bold">Diagrama de Base de Datos</h1>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-disabled border border-border">
          Polleria PostgreSQL
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <DbDiagram />
      </div>
    </main>
  );
}
