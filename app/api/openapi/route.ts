import { NextResponse } from 'next/server';
import swaggerJSDoc from 'swagger-jsdoc';
import { swaggerOptions } from './swaggerConfig';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Scan the app/api directory (excluding openapi) and add minimal OpenAPI path
 * objects for any file that exports a HTTP handler (GET, POST, PUT, PATCH, DELETE).
 * Guarantees Swagger UI shows **all** endpoints even without JSDoc comments.
 */
async function addDiscoveredPaths(spec: any) {
  const apiRoot = path.resolve(process.cwd(), 'app', 'api');

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'openapi') continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relative = path.relative(apiRoot, fullPath);
        let urlPath = '/' + relative.replace(/\\/g, '/');
        urlPath = urlPath.replace(/\/route\.ts$/i, '').replace(/\/index\.ts$/i, '');
        if (!urlPath.startsWith('/api')) urlPath = '/api' + urlPath;
        urlPath = urlPath.replace(/\/+$/, '');
        const content = await fs.readFile(fullPath, 'utf8');
        const methods: string[] = [];
        if (/export\s+(?:const|async\s+function|function)\s+GET\b/.test(content)) methods.push('get');
        if (/export\s+(?:const|async\s+function|function)\s+POST\b/.test(content)) methods.push('post');
        if (/export\s+(?:const|async\s+function|function)\s+PUT\b/.test(content)) methods.push('put');
        if (/export\s+(?:const|async\s+function|function)\s+PATCH\b/.test(content)) methods.push('patch');
        if (/export\s+(?:const|async\s+function|function)\s+DELETE\b/.test(content)) methods.push('delete');
        if (methods.length === 0) continue;
        spec.paths = spec.paths ?? {};
        spec.paths[urlPath] = spec.paths[urlPath] ?? {};
        for (const m of methods) {
          if (!spec.paths[urlPath][m]) {
            spec.paths[urlPath][m] = {
              summary: "Auto-generated endpoint",
              operationId: `${m}`,
              responses: { '200': { description: 'Successful response' } },
            };
          }
        }
      }
    }
  }

  await walk(apiRoot);
}

import type { OpenAPIV3 } from 'openapi-types';

export const GET = async () => {
  const spec = swaggerJSDoc(swaggerOptions) as OpenAPIV3.Document;
  spec.components = spec.components ?? {};
  spec.components.schemas = {
    ...(spec.components.schemas ?? {}),
    AccountingPeriod: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
      },
      required: ['id', 'startDate', 'endDate', 'status'],
    },
    NewAccountingPeriod: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
      },
      required: ['startDate', 'endDate'],
    },
  };
  await addDiscoveredPaths(spec);
  return NextResponse.json(spec);
};
