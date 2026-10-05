import { NextResponse } from 'next/server';
import swaggerJSDoc from 'swagger-jsdoc';
import { swaggerOptions } from './swaggerConfig';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Scan the `app/api` directory (excluding `openapi`) and add minimal OpenAPI path
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
        let urlPath = '/' + relative.replace(/\\\\/g, '/');
        urlPath = urlPath.replace(/\/route\.ts$/i, '').replace(/\/index\.ts$/i, '');
        if (!urlPath.startsWith('/api')) urlPath = '/api' + urlPath;

        const content = await fs.readFile(fullPath, 'utf8');
        const methods: string[] = [];
        if (/export\s+const\s+GET\s*=/.test(content)) methods.push('get');
        if (/export\s+const\s+POST\s*=/.test(content)) methods.push('post');
        if (/export\s+const\s+PUT\s*=/.test(content)) methods.push('put');
        if (/export\s+const\s+PATCH\s*=/.test(content)) methods.push('patch');
        if (/export\s+const\s+DELETE\s*=/.test(content)) methods.push('delete');
        if (methods.length === 0) continue;

        spec.paths = spec.paths ?? {};
        spec.paths[urlPath] = spec.paths[urlPath] ?? {};
        for (const m of methods) {
          if (!spec.paths[urlPath][m]) {
            spec.paths[urlPath][m] = {
              summary: `Auto‑generated ${m.toUpperCase()} endpoint`,
              operationId: `${m}${urlPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
              responses: { '200': { description: 'Successful response' } },
            };
          }
        }
      }
    }
  }

  await walk(apiRoot);
}

export const GET = async () => {
  // Base spec from JSDoc annotations
  const spec = swaggerJSDoc(swaggerOptions);

  // Ensure core schemas are present (may not be referenced via JSDoc)
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

  // Auto‑discover any undocumented routes
  await addDiscoveredPaths(spec);

  return NextResponse.json(spec);
};

import swaggerJSDoc from 'swagger-jsdoc';
import { swaggerOptions } from './swaggerConfig';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Scan the `app/api` directory (excluding `openapi`) and add minimal OpenAPI path
 * objects for any file that exports a HTTP handler (GET, POST, PUT, PATCH, DELETE).
 * This guarantees that Swagger UI displays **all** endpoints even if you haven't
 * written JSDoc comments for them.
 */
async function addDiscoveredPaths(spec: any) {
  const apiRoot = path.resolve(process.cwd(), 'app', 'api');

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'openapi') continue; // avoid recursion
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relative = path.relative(apiRoot, fullPath);
        let urlPath = '/' + relative.replace(/\\\\/g, '/');
        urlPath = urlPath.replace(/\/route\.ts$/i, '').replace(/\/index\.ts$/i, '');
        if (!urlPath.startsWith('/api')) urlPath = '/api' + urlPath;
        const content = await fs.readFile(fullPath, 'utf8');
        const methods: string[] = [];
        if (/export\s+const\s+GET\s*=/.test(content)) methods.push('get');
        if (/export\s+const\s+POST\s*=/.test(content)) methods.push('post');
        if (/export\s+const\s+PUT\s*=/.test(content)) methods.push('put');
        if (/export\s+const\s+PATCH\s*=/.test(content)) methods.push('patch');
        if (/export\s+const\s+DELETE\s*=/.test(content)) methods.push('delete');
        if (methods.length === 0) continue;
        spec.paths = spec.paths ?? {};
        spec.paths[urlPath] = spec.paths[urlPath] ?? {};
        for (const m of methods) {
          if (!spec.paths[urlPath][m]) {
            spec.paths[urlPath][m] = {
              summary: `Auto‑generated ${m.toUpperCase()} endpoint`,
              operationId: `${m}${urlPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
              responses: { '200': { description: 'Successful response' } },
            };
          }
        }
      }
    }
  }

  await walk(apiRoot);
}

export const GET = async () => {
  // Generate base spec from JSDoc annotations
  const spec = swaggerJSDoc(swaggerOptions);

  // Ensure core schemas are present (they may not be referenced via JSDoc)
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

  // Auto‑discover any routes that lack explicit JSDoc documentation
  await addDiscoveredPaths(spec);

  return NextResponse.json(spec);
};

import swaggerJSDoc from 'swagger-jsdoc';
import { swaggerOptions } from './swaggerConfig';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Scans the `app/api` folder (excluding the `openapi` subfolder) and adds a minimal
 * OpenAPI path entry for each file that exports a HTTP handler (GET, POST, PUT,
 * DELETE, PATCH). This ensures that **all** endpoints appear in Swagger UI even
 * if they are not documented with JSDoc comments.
 */
async function addDiscoveredPaths(spec: any) {
  const apiRoot = path.resolve(process.cwd(), 'app', 'api');
  const entries = await fs.readdir(apiRoot, { withFileTypes: true });

  // Helper to recurse into directories
  async function walk(dir: string) {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip the openapi folder to avoid recursion
        if (entry.name === 'openapi') continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Derive the URL path from the file location (remove "route.ts" and prepend /api)
        const relative = path.relative(apiRoot, fullPath);
        // Remove the trailing "route.ts" or "index.ts"
        let urlPath = '/' + relative.replace(/\\\\/g, '/');
        urlPath = urlPath.replace(/\/route\.ts$/i, '').replace(/\/index\.ts$/i, '');
        // Ensure leading slash and no trailing slash
        if (!urlPath.startsWith('/api')) urlPath = '/api' + urlPath;
        const content = await fs.readFile(fullPath, 'utf8');
        const methods: string[] = [];
        if (/export\s+const\s+GET\s*=/.test(content)) methods.push('get');
        if (/export\s+const\s+POST\s*=/.test(content)) methods.push('post');
        if (/export\s+const\s+PUT\s*=/.test(content)) methods.push('put');
        if (/export\s+const\s+PATCH\s*=/.test(content)) methods.push('patch');
        if (/export\s+const\s+DELETE\s*=/.test(content)) methods.push('delete');
        if (methods.length === 0) continue;
        spec.paths = spec.paths ?? {};
        spec.paths[urlPath] = spec.paths[urlPath] ?? {};
        for (const m of methods) {
          // Avoid overwriting if already defined via JSDoc
          if (!spec.paths[urlPath][m]) {
            spec.paths[urlPath][m] = {
              summary: `Auto‑generated ${m.toUpperCase()} endpoint`,
              operationId: `${m}${urlPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
              responses: {
                '200': { description: 'Successful response' },
              },
            };
          }
        }
      }
    }
  }

  await walk(apiRoot);
}

export const GET = async () => {
  // Generate the OpenAPI spec from JSDoc comments in the API folder
  const spec = swaggerJSDoc(swaggerOptions);

  // Ensure the manually defined schemas are present (they might not be referenced via JSDoc)
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

  // Add any discovered endpoints that lack explicit JSDoc documentation
  await addDiscoveredPaths(spec);

  return NextResponse.json(spec);
};

import swaggerJSDoc from 'swagger-jsdoc';
import { swaggerOptions } from './swaggerConfig';

export const GET = async () => {
  // Generate the OpenAPI spec from JSDoc comments in the API folder
  const spec = swaggerJSDoc(swaggerOptions);

  // Ensure the manually defined schemas are present (they might not be referenced via JSDoc)
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

  return NextResponse.json(spec);
};
