import type { OpenAPIV3 } from 'swagger-jsdoc';

/**
 * Base OpenAPI definition used by swagger-jsdoc.
 * Adjust the `info` section as needed for your project.
 */
export const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Polleria API',
    version: '1.0.0',
    description: 'Documentación automática de todos los endpoints de la aplicación Polleria',
  },
  servers: [{ url: '/' }],
  components: {
    schemas: {
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
    },
  },
};

/**
 * swagger-jsdoc options.
 * It scans every `*.ts` file under `app/api` (excluding this openapi folder) for
 * JSDoc `@openapi` blocks.
 */
export const swaggerOptions = {
  definition: swaggerDefinition,
  apis: ['app/api/**/*.ts', '!app/api/openapi/**/*.ts'],
};
