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
  tags: [
    { name: 'Auth', description: 'Sesión de usuario: inicio y cierre de sesión.' },
    { name: 'Usuarios', description: 'Gestión de usuarios del sistema.' },
    { name: 'Accounts', description: 'Plan contable: cuentas contables raíz y subcuentas.' },
    { name: 'AccountingPeriods', description: 'Períodos contables (meses) abiertos o cerrados.' },
    { name: 'JournalEntries', description: 'Asientos contables: listado, detalle, creación y datos de apoyo.' },
    { name: 'Reports', description: 'Reportes contables: libro diario, libro mayor y balance general.' },
    { name: 'Orders', description: 'Pedidos de mesa y su ciclo de vida.' },
    { name: 'Sales', description: 'Ventas registradas.' },
    { name: 'Menu', description: 'Platos del menú.' },
    { name: 'Tables', description: 'Mesas del salón.' },
    { name: 'Customers', description: 'Clientes.' },
    { name: 'PaymentMethods', description: 'Métodos de pago disponibles.' },
    { name: 'Stock', description: 'Consulta y ajuste de inventario.' },
    { name: 'DocumentLookup', description: 'Consulta de datos de documento (DNI/RUC).' },
    { name: 'Webhooks', description: 'Callbacks externos (pasarela de pagos).' },
  ],
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Mensaje legible para el cliente.',
            example: 'No se pudo obtener el recurso.',
          },
          errores: {
            type: 'array',
            description: 'Lista completa de validaciones fallidas (opcional).',
            items: { type: 'string' },
            example: ['El campo es obligatorio.'],
          },
        },
        required: ['error'],
      },
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
