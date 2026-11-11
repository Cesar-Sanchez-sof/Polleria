import type { OpenAPIV3 } from "openapi-types";
import { DEFAULT_TAG_BY_PREFIX, USE_CASES } from "./use-cases";

const HANDLER_RE = /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

/** Permisos RBAC por método HTTP, extraídos del código fuente de un route handler. */
export function extractPermissions(source: string): Record<string, string[]> {
  const found: Array<{ method: string; index: number }> = [];
  for (const m of source.matchAll(HANDLER_RE)) found.push({ method: m[1], index: m.index ?? 0 });
  const result: Record<string, string[]> = {};
  found.forEach((h, i) => {
    const segment = source.slice(h.index, found[i + 1]?.index ?? source.length);
    const perms = new Set<string>();
    for (const m of segment.matchAll(/(?:permission:\s*|authorize\()(\[[^\]]*\]|"[^"]*")/g)) {
      for (const p of m[1].matchAll(/"([^"]+)"/g)) perms.add(p[1]);
    }
    if (/requireAuth:\s*true/.test(segment)) perms.add("(sesión iniciada)");
    result[h.method] = [...perms];
  });
  return result;
}

const ERROR_RESPONSES: Record<string, string> = {
  "400": "Petición inválida (parámetros o cuerpo no cumplen las reglas de negocio).",
  "401": "Sesión no iniciada o vencida.",
  "403": "El usuario no tiene el permiso requerido.",
  "500": "Error interno inesperado.",
};

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Añade a cada operación sus casos de uso, el permiso requerido y las respuestas de error
 * comunes. `permissions` es "MÉTODO /ruta" → permisos (de `extractPermissions`).
 */
export function enrichOperations(spec: OpenAPIV3.Document, permissions: ReadonlyMap<string, string[]>) {
  for (const [urlPath, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = (item as Record<string, OpenAPIV3.OperationObject | undefined>)[method];
      if (!op) continue;
      const key = `${method.toUpperCase()} ${urlPath}`;
      const entry = USE_CASES[key];
      const perms = permissions.get(key) ?? [];

      const parts: string[] = [];
      if (op.description) parts.push(op.description.trim());
      parts.push(
        perms.length
          ? `**Permiso requerido:** ${perms.map((p) => `\`${p}\``).join(" o ")}`
          : "**Permiso requerido:** ninguno específico (endpoint abierto o con validación propia).",
      );
      if (entry?.uses.length) parts.push(`**Casos de uso:**\n${entry.uses.map((u) => `- ${u}`).join("\n")}`);
      op.description = parts.join("\n\n");

      if (!op.summary || op.summary === "Auto-generated endpoint") op.summary = entry?.summary ?? entry?.uses[0] ?? op.summary;
      if (!op.tags?.length) {
        op.tags = [entry?.tag ?? DEFAULT_TAG_BY_PREFIX.find(([prefix]) => urlPath.startsWith(prefix))?.[1] ?? "General"];
      }

      op.responses = op.responses ?? {};
      for (const [code, description] of Object.entries(ERROR_RESPONSES)) {
        if ((code === "401" || code === "403") && perms.length === 0) continue;
        if (!op.responses[code]) op.responses[code] = { description };
      }
    }
  }
}
