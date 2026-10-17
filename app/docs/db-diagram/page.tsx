'use client';

import { DbDiagram } from './db-diagram';
import { ModuleHeader } from '@/components/shared/ModuleHeader';
import { Database } from 'lucide-react';

export default function DBDiagramPage() {
  return (
    <main style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <ModuleHeader
        title="Diagrama de Base de Datos"
        subtitle="Entidades y relaciones del esquema PostgreSQL de la Pollería."
        icon={Database}
        iconClassName="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
      />
      <div className="flex-1 overflow-hidden">
        <DbDiagram />
      </div>
    </main>
  );
}
