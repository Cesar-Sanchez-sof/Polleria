import { type Edge, getSmoothStepPath, type InternalNode, Position } from '@xyflow/react';
import type { ArchitectureNodeData } from './architecture-data';

const CARD_WIDTH = 320;
const CARD_HEIGHT = 220;
const PAD = 80;

function esc(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function handlePoint(
  node: InternalNode | undefined,
  kind: 'source' | 'target',
  handleId?: string | null
) {
  const handle = node?.internals.handleBounds?.[kind]?.find((h) => h.id === handleId);
  if (!node || !handle) return null;
  const { x, y } = node.internals.positionAbsolute;
  return {
    x: handle.position === Position.Left ? x + handle.x : x + handle.x + handle.width,
    y: y + handle.y + handle.height / 2,
    position: handle.position,
  };
}

/**
 * Builds a high-quality, pixel-perfect SVG that mirrors the web canvas appearance:
 * - Crisp white background with subtle dot grid
 * - Exact 6 Tier Containers (Subgraphs) with dashed borders and headers
 * - Cards styled with drop shadows, color headers, tech tags and governance alerts
 * - Smooth step edges with labels
 */
export function buildArchitectureSvg(
  nodes: InternalNode[],
  edges: Edge[]
): { svg: string; width: number; height: number; minX: number; minY: number } {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const { x, y } = n.internals.positionAbsolute;
    const isGroup = n.type === 'tierGroup';
    const w = (n.data as { width?: number }).width ?? (isGroup ? 2980 : CARD_WIDTH);
    const h = (n.data as { height?: number }).height ?? (isGroup ? 275 : CARD_HEIGHT);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  minX -= PAD;
  minY -= PAD;
  maxX += PAD;
  maxY += PAD;

  const width = Math.max(maxX - minX, 1200);
  const height = Math.max(maxY - minY, 800);

  const out: string[] = [];

  // 1. Defs: Drop shadows, Dot grid pattern and arrow markers
  out.push(
    `<defs>`,
    `  <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">`,
    `    <circle cx="2" cy="2" r="1.2" fill="#cbd5e1" opacity="0.65" />`,
    `  </pattern>`,
    `  <filter id="card-shadow" x="-8%" y="-8%" width="120%" height="120%">`,
    `    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.07" />`,
    `  </filter>`,
    `  <marker id="edge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`,
    `    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" opacity="0.75" />`,
    `  </marker>`,
    `</defs>`,
    // Background: Solid pure white + dot grid (identical to web canvas)
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#dot-grid)" />`
  );

  // 2. Draw Tier Containers (Subgraphs) as background frames
  for (const node of nodes) {
    if (node.type !== 'tierGroup') continue;
    const data = node.data as {
      title: string;
      subtitle: string;
      color: string;
      width: number;
      height: number;
      badge?: string;
    };
    const { x, y } = node.internals.positionAbsolute;
    const w = data.width || 2980;
    const h = data.height || 275;

    out.push(
      // Container border and background
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${data.color}" fill-opacity="0.035" stroke="${data.color}" stroke-opacity="0.45" stroke-dasharray="8,8" stroke-width="2"/>`,
      // Header banner inside container
      `<path d="M ${x + 2} ${y + 2} H ${x + w - 2} V ${y + 42} H ${x + 2} Z" fill="${data.color}" fill-opacity="0.12"/>`,
      `<line x1="${x + 2}" y1="${y + 42}" x2="${x + w - 2}" y2="${y + 42}" stroke="${data.color}" stroke-opacity="0.25" stroke-width="1"/>`,
      // Indicator circle
      `<circle cx="${x + 24}" cy="${y + 22}" r="5" fill="${data.color}"/>`,
      // Container title
      `<text x="${x + 40}" y="${y + 26}" font-size="12.5" font-weight="900" fill="${data.color}" letter-spacing="1.2">${esc(data.title)}</text>`
    );

    // Optional badge in container header
    if (data.badge) {
      const badgeW = data.badge.length * 6.5 + 16;
      const badgeX = x + 40 + data.title.length * 7.5 + 20;
      out.push(
        `<rect x="${badgeX}" y="${y + 12}" width="${badgeW}" height="20" rx="10" fill="${data.color}" fill-opacity="0.2"/>`,
        `<text x="${badgeX + badgeW / 2}" y="${y + 25}" text-anchor="middle" font-size="10" font-weight="800" fill="${data.color}">${esc(data.badge)}</text>`
      );
    }

    // Subtitle on the right
    out.push(
      `<text x="${x + w - 24}" y="${y + 26}" text-anchor="end" font-size="11" font-weight="500" fill="#64748b">${esc(data.subtitle)}</text>`
    );
  }

  // 3. Draw Edges with smooth curves and labels
  for (const edge of edges) {
    const src = handlePoint(byId.get(edge.source), 'source', edge.sourceHandle);
    const dst = handlePoint(byId.get(edge.target), 'target', edge.targetHandle);
    if (!src || !dst) continue;

    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: dst.x,
      targetY: dst.y,
      targetPosition: dst.position,
    });

    out.push(
      `<path d="${path}" fill="none" stroke="#6366f1" stroke-opacity="0.65" stroke-width="1.8" stroke-dasharray="${edge.animated ? '5,5' : 'none'}"/>`
    );

    if (edge.label) {
      const text = String(edge.label);
      const textWidth = text.length * 6.2 + 16;
      out.push(
        `<rect x="${labelX - textWidth / 2}" y="${labelY - 10}" width="${textWidth}" height="20" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>`,
        `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="600" fill="#0f172a">${esc(
          text
        )}</text>`
      );
    }
  }

  // 4. Draw Component Cards (identical to ArchitectureCardNode on web)
  for (const node of nodes) {
    if (node.type === 'tierGroup') continue;
    const data = node.data as unknown as ArchitectureNodeData;
    const { x, y } = node.internals.positionAbsolute;
    const w = node.measured.width ?? CARD_WIDTH;
    const h = node.measured.height ?? CARD_HEIGHT;

    // Card Box with elevation shadow
    out.push(
      `<g filter="url(#card-shadow)">`,
      `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>`,
      `</g>`,
      // Top color border
      `<path d="M ${x + 1} ${y + 1} H ${x + w - 1} V ${y + 5} H ${x + 1} Z" fill="${data.color}"/>`,
      // Icon square container on top left
      `<rect x="${x + 14}" y="${y + 14}" width="34" height="34" rx="8" fill="${data.color}" fill-opacity="0.12" stroke="${data.color}" stroke-opacity="0.25" stroke-width="1"/>`,
      `<circle cx="${x + 31}" cy="${y + 31}" r="6" fill="${data.color}"/>`,
      // Title
      `<text x="${x + 56}" y="${y + 27}" font-size="13" font-weight="700" fill="#0f172a">${esc(data.title)}</text>`,
      // Subtitle
      `<text x="${x + 56}" y="${y + 42}" font-size="10" font-family="ui-monospace, monospace" fill="#64748b">${esc(data.subtitle)}</text>`
    );

    // Tier Pill Badge on top right
    const tierText = (data.tier || 'core').toUpperCase();
    const tierW = tierText.length * 6 + 14;
    out.push(
      `<rect x="${x + w - tierW - 14}" y="${y + 14}" width="${tierW}" height="18" rx="9" fill="${data.color}" fill-opacity="0.1" stroke="${data.color}" stroke-opacity="0.3" stroke-width="1"/>`,
      `<text x="${x + w - 14 - tierW / 2}" y="${y + 26}" text-anchor="middle" font-size="9" font-weight="700" fill="${data.color}">${esc(tierText)}</text>`
    );

    // Tech Tags row
    if (data.technologies && data.technologies.length > 0) {
      let tagX = x + 14;
      const tagY = y + 58;
      for (const tech of data.technologies.slice(0, 3)) {
        const tw = tech.length * 5.8 + 10;
        out.push(
          `<rect x="${tagX}" y="${tagY}" width="${tw}" height="16" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8"/>`,
          `<text x="${tagX + tw / 2}" y="${tagY + 11}" text-anchor="middle" font-size="8.8" font-weight="600" fill="#475569">${esc(tech)}</text>`
        );
        tagX += tw + 4;
      }
    }

    // Divider line
    out.push(
      `<line x1="${x}" y1="${y + 82}" x2="${x + w}" y2="${y + 82}" stroke="#f1f5f9" stroke-width="1.2"/>`
    );

    // Responsibilities label
    out.push(
      `<text x="${x + 14}" y="${y + 96}" font-size="8.8" font-weight="700" fill="#94a3b8" letter-spacing="0.6">RESPONSABILIDADES CLAVE:</text>`
    );

    // Responsibilities bullet points
    let respY = y + 112;
    for (const resp of data.responsibilities.slice(0, 3)) {
      out.push(
        `<path d="M ${x + 14} ${respY - 4} L ${x + 18} ${respY - 1} L ${x + 14} ${respY + 2}" fill="none" stroke="${data.color}" stroke-width="1.4" stroke-linecap="round"/>`,
        `<text x="${x + 24}" y="${respY}" font-size="10" font-weight="500" fill="#334155">${esc(resp)}</text>`
      );
      respY += 18;
    }

    // AGENTS.md Governance rule alert box
    if (data.rules && data.rules.length > 0) {
      const bannerY = y + h - 28;
      out.push(
        `<rect x="${x + 12}" y="${bannerY}" width="${w - 24}" height="20" rx="5" fill="#fef3c7" stroke="#fde68a" stroke-width="0.8"/>`,
        `<text x="${x + 20}" y="${bannerY + 13}" font-size="9" font-weight="600" fill="#b45309">🛡️ ${esc(data.rules[0])}</text>`
      );
    }
  }

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`,
    `<style>`,
    `text { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }`,
    `</style>`,
    out.join('\n'),
    `</svg>`,
  ].join('\n');

  return { svg, width, height, minX, minY };
}

/**
 * Downloads the complete architecture diagram in vector SVG format.
 * High quality, scalable to any resolution without loss of clarity.
 */
export function downloadArchitectureSvg(nodes: InternalNode[], edges: Edge[]): void {
  const { svg } = buildArchitectureSvg(nodes, edges);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `polleria-diagrama-arquitectura-${new Date().toISOString().slice(0, 10)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
