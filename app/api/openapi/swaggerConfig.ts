import type { OpenAPIV3 } from 'openapi-types';

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
  paths: {},
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
          errors: {
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
      /**
       * Formato público de una cuenta contable, compartido con cada elemento de
       * GET /api/accounts. Especificación: specs/024-consultar-cuenta-contable
       * (contracts/accounts-detail.openapi.yaml). `usos` = número de líneas de
       * asiento que usan la cuenta (derivado; 0 si nunca se usa).
       */
      Account: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Identificador numérico de la cuenta.', example: 7 },
          code: {
            type: 'string',
            maxLength: 10,
            pattern: '^[A-Za-z0-9.-]{1,10}$',
            description: 'Código único de la cuenta en el plan contable.',
            example: '104',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Nombre de la cuenta.',
            example: 'Bancos',
          },
          type: {
            type: 'string',
            enum: ['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto', 'Costo'],
            description: 'Tipo de cuenta (catálogo PCGE).',
            example: 'Activo',
          },
          parentId: {
            type: 'integer',
            nullable: true,
            description: 'Cuenta padre; null en cuentas raíz.',
            example: null,
          },
          active: {
            type: 'boolean',
            description: 'Estado de la cuenta (true = activa). Las inactivas también se consultan.',
            example: true,
          },
          uses: {
            type: 'integer',
            minimum: 0,
            description: 'Líneas de asiento que usan la cuenta (derivado; 0 si nunca se usa).',
            example: 4,
          },
        },
        required: ['id', 'codigo', 'nombre', 'tipo', 'idPadre', 'activo', 'usos'],
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
