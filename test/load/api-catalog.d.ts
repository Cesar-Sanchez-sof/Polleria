export interface ApiCatalogEntry {
  route: string;
  domain: string;
  methods: string[];
  safety: "read" | "auth" | "realtime-sse" | "external-read" | "external-heavy" | "write";
  samplePath?: (context: {
    today: string;
    year: number;
    month: number;
    monthStart: string;
    ids: Record<string, number | string>;
  }) => string;
}

export interface ApiCatalogResolvedEntry extends ApiCatalogEntry {
  url: string;
}

export const API_CATALOG: ApiCatalogEntry[];

export function buildCatalogUrls(context?: {
  today?: string;
  year?: number;
  month?: number;
  monthStart?: string;
  ids?: Record<string, number | string>;
}): ApiCatalogResolvedEntry[];
