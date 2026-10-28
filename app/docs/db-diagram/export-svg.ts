import { type Edge, getSmoothStepPath, type InternalNode, Position } from '@xyflow/react';

const FIELD_HEIGHT = 24;
const FALLBACK_WIDTH = 274;
const PAD = 80;

const PK_COLOR = '#fbbf24';
const FK_COLOR = '#60a5fa';

/** Subset of the entity card data the export needs (same shape as `EntityDef`). */
interface ExportEntity {
	label: string;
	module: string;
	color: string;
	fields: { name: string; type: string; kind: 'pk' | 'fk' | 'field'; optional?: boolean }[];
}

interface Point {
	x: number;
	y: number;
	position: Position;
}

function esc(value: unknown) {
	return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Same math React Flow uses to place an edge end on a handle. */
function handlePoint(node: InternalNode | undefined, kind: 'source' | 'target', handleId?: string | null): Point | null {
	const handle = node?.internals.handleBounds?.[kind]?.find((h) => h.id === handleId);
	if (!node || !handle) return null;
	const { x, y } = node.internals.positionAbsolute;
	return {
		x: handle.position === Position.Left ? x + handle.x : x + handle.x + handle.width,
		y: y + handle.y + handle.height / 2,
		position: handle.position,
	};
}

function buildSvg(nodes: InternalNode[], edges: Edge[], root: Element): string {
	const css = getComputedStyle(root);
	const fg = css.getPropertyValue('--foreground').trim() || '#0d1c2e';
	const surface = css.getPropertyValue('--color-surface').trim() || '#ffffff';
	const byId = new Map(nodes.map((n) => [n.id, n]));

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const n of nodes) {
		const { x, y } = n.internals.positionAbsolute;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + (n.measured.width ?? FALLBACK_WIDTH));
		maxY = Math.max(maxY, y + (n.measured.height ?? 0));
	}
	minX -= PAD;
	minY -= PAD;
	maxX += PAD;
	maxY += PAD;

	const out: string[] = [];

	// Edges first so the cards stay on top.
	for (const edge of edges) {
		const src = handlePoint(byId.get(edge.source), 'source', edge.sourceHandle);
		const dst = handlePoint(byId.get(edge.target), 'target', edge.targetHandle);
		if (!src || !dst) continue;

		const [path, labelX, labelY] = getSmoothStepPath({
			sourceX: src.x, sourceY: src.y, sourcePosition: src.position,
			targetX: dst.x, targetY: dst.y, targetPosition: dst.position,
		});
		out.push(`<path d="${path}" fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="1.25"/>`);

		const card = edge.data as { sourceCardinality: string; targetCardinality: string } | undefined;
		const near = (p: Point) => ({ x: p.x + (p.position === Position.Left ? -12 : 12), y: p.y - 10 });
		for (const [point, text] of [[src, card?.sourceCardinality], [dst, card?.targetCardinality]] as const) {
			if (!text) continue;
			const c = near(point);
			out.push(`<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="${fg}">${esc(text)}</text>`);
		}

		if (edge.label) {
			const text = String(edge.label);
			const w = text.length * 5 + 8;
			out.push(
				`<rect x="${labelX - w / 2}" y="${labelY - 7}" width="${w}" height="14" rx="3" fill="${surface}" fill-opacity="0.85"/>`,
				`<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${fg}">${esc(text)}</text>`,
			);
		}
	}

	nodes.forEach((node, index) => {
		const entity = node.data as unknown as ExportEntity;
		const { x, y } = node.internals.positionAbsolute;
		const w = node.measured.width ?? FALLBACK_WIDTH;
		const h = node.measured.height ?? 0;
		const fieldsTop = y + h - 1 - entity.fields.length * FIELD_HEIGHT;
		const headerH = fieldsTop - y;
		const clip = `clip-${index}`;

		out.push(
			`<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/></clipPath>`,
			`<g clip-path="url(#${clip})">`,
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${surface}"/>`,
			`<rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="${entity.color}" fill-opacity="0.1"/>`,
			`<line x1="${x}" y1="${fieldsTop}" x2="${x + w}" y2="${fieldsTop}" stroke="${entity.color}" stroke-opacity="0.25" stroke-width="1.5"/>`,
		);

		const iconY = y + headerH / 2;
		out.push(
			`<rect x="${x + 12}" y="${iconY - 10}" width="20" height="20" rx="6" fill="${entity.color}" fill-opacity="0.15"/>`,
			`<ellipse cx="${x + 22}" cy="${iconY - 3}" rx="5" ry="2.5" fill="none" stroke="${entity.color}" stroke-width="1.2"/>`,
			`<path d="M${x + 17} ${iconY - 3}v6c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-6" fill="none" stroke="${entity.color}" stroke-width="1.2"/>`,
			`<text x="${x + 40}" y="${iconY}" dominant-baseline="central" font-size="12" font-weight="700" fill="${entity.color}">${esc(entity.label)}</text>`,
		);

		const badge = entity.module.toUpperCase();
		const bw = badge.length * 5.6 + 14;
		out.push(
			`<rect x="${x + w - 12 - bw}" y="${iconY - 8}" width="${bw}" height="16" rx="8" fill="${entity.color}" fill-opacity="0.12"/>`,
			`<text x="${x + w - 12 - bw / 2}" y="${iconY}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="600" fill="${entity.color}">${esc(badge)}</text>`,
		);

		entity.fields.forEach((field, i) => {
			const top = fieldsTop + i * FIELD_HEIGHT;
			const mid = top + FIELD_HEIGHT / 2;
			if (i > 0) out.push(`<line x1="${x}" y1="${top}" x2="${x + w}" y2="${top}" stroke="${fg}" stroke-opacity="0.1"/>`);

			if (field.kind === 'field') {
				out.push(`<rect x="${x + 12}" y="${mid - 4}" width="8" height="8" rx="2" fill="${fg}" fill-opacity="0.2"/>`);
			} else {
				out.push(`<circle cx="${x + 16}" cy="${mid}" r="4" fill="${field.kind === 'pk' ? PK_COLOR : FK_COLOR}"/>`);
			}

			const nameColor = field.kind === 'pk' ? PK_COLOR : field.kind === 'fk' ? FK_COLOR : fg;
			const opacity = field.optional ? 0.6 : 1;
			out.push(
				`<text x="${x + 28}" y="${mid}" dominant-baseline="central" font-size="11" font-family="monospace" fill="${nameColor}" fill-opacity="${opacity}">${esc(field.name)}</text>`,
				`<text x="${x + w - 12}" y="${mid}" text-anchor="end" dominant-baseline="central" font-size="10" font-family="monospace" fill="${fg}" fill-opacity="0.55">${esc(field.type)}${field.optional ? '?' : ''}</text>`,
			);
		});

		out.push(
			`</g>`,
			`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="12" fill="none" stroke="${fg}" stroke-opacity="0.2"/>`,
		);
	});

	const width = maxX - minX;
	const height = maxY - minY;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">`,
		`<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${surface}"/>`,
		...out,
		`</svg>`,
	].join('\n');
}

/** Builds a standalone vector SVG of the diagram as currently laid out and downloads it. */
export function downloadDiagramSvg(nodes: InternalNode[], edges: Edge[], fileName = 'diagrama-bd.svg') {
	const root = document.querySelector('.react-flow') ?? document.documentElement;
	const blob = new Blob([buildSvg(nodes, edges, root)], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
