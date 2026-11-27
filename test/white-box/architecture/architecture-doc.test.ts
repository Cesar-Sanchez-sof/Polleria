import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_LAYERS,
  ARCHITECTURE_NODES,
  ARCHITECTURE_EDGES,
  TIER_CONTAINERS,
  LIFECYCLE_FLOWS,
  MODULE_FILTERS,
} from '@/app/docs/architecture/architecture-data';
import { linkPermission } from '@/lib/auth/route-permissions';

describe('Documentación Integral de Arquitectura (Todos los Módulos)', () => {
  it('define las 6 capas arquitectónicas del sistema', () => {
    const layerKeys = Object.keys(ARCHITECTURE_LAYERS);
    expect(layerKeys).toContain('clients');
    expect(layerKeys).toContain('presentation');
    expect(layerKeys).toContain('domain');
    expect(layerKeys).toContain('ai');
    expect(layerKeys).toContain('persistence');
    expect(layerKeys).toContain('external');
  });

  it('cubre todos los módulos funcionales del ERP: Compras, Ventas, Inventario, Contabilidad, RRHH, Seguridad', () => {
    const modulesInNodes = new Set(ARCHITECTURE_NODES.map((n) => n.module));
    expect(modulesInNodes.has('sales')).toBe(true);
    expect(modulesInNodes.has('purchases')).toBe(true);
    expect(modulesInNodes.has('inventory')).toBe(true);
    expect(modulesInNodes.has('accounting')).toBe(true);
    expect(modulesInNodes.has('hr')).toBe(true);
    expect(modulesInNodes.has('security')).toBe(true);
    expect(modulesInNodes.has('settings')).toBe(true);
    expect(modulesInNodes.has('ai')).toBe(true);
    expect(modulesInNodes.has('integrations')).toBe(true);
  });

  it('incluye los 8 Bounded Contexts de servicios de dominio DDD', () => {
    const domainNodeIds = ARCHITECTURE_NODES.filter((n) => n.tier === 'domain').map((n) => n.id);
    expect(domainNodeIds).toEqual(
      expect.arrayContaining([
        'domain-sales',
        'domain-inventory',
        'domain-purchases',
        'domain-accounting',
        'domain-hr',
        'domain-security',
        'domain-settings',
        'domain-integrations',
      ])
    );
  });

  it('todas las conexiones (edges) apuntan a nodos válidos y existentes', () => {
    const nodeIds = new Set(ARCHITECTURE_NODES.map((n) => n.id));
    for (const edge of ARCHITECTURE_EDGES) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it('define los 7 ciclos de vida operativos (Ventas, Compras, Inventario, Contabilidad, RRHH, Seguridad, IA)', () => {
    expect(LIFECYCLE_FLOWS.length).toBe(7);
    const flowIds = LIFECYCLE_FLOWS.map((f) => f.id);
    expect(flowIds).toEqual([
      'sales-lifecycle',
      'purchases-lifecycle',
      'inventory-lifecycle',
      'accounting-lifecycle',
      'hr-lifecycle',
      'security-lifecycle',
      'ai-lifecycle',
    ]);

    for (const flow of LIFECYCLE_FLOWS) {
      expect(flow.steps.length).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < flow.steps.length; i++) {
        expect(flow.steps[i].step).toBe(i + 1);
      }
    }
  });

  it('define las 6 cajas contenedoras (subgraphs) de la arquitectura', () => {
    const containerIds = TIER_CONTAINERS.map((c) => c.id);
    expect(containerIds).toEqual([
      'group-frontend',
      'group-gateway',
      'group-domain',
      'group-ai',
      'group-persistence',
      'group-external',
    ]);
  });

  it('la ruta /docs/architecture está registrada con permisos de acceso', () => {
    const permission = linkPermission('/docs/architecture');
    expect(permission).toBe('diagrama.ver');
  });
});
