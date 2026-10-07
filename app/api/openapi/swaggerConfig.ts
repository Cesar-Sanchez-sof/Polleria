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
      IncomeStatement: {
        type: 'object',
        description:
          'Estado de Resultados por Función (PCGE 2019 / NIIF). Todos los importes en PEN con dos decimales; las líneas sin movimientos valen 0.00.',
        properties: {
          operating_income: {
            type: 'object',
            description:
              'Ingresos de operación: Cuenta 70 (701, 702, 704…) menos las cuentas deudoras 709 y 74.',
            properties: {
              ordinary_income: { type: 'number', example: 920 },
              sublease_and_other_income: { type: 'number', example: 0 },
              total: { type: 'number', example: 920 },
            },
            required: ['ordinary_income', 'sublease_and_other_income', 'total'],
          },
          sales_costs: {
            type: 'object',
            description: 'Saldo deudor de la Cuenta 69 (costo de ventas).',
            properties: { cost_of_goods_sold: { type: 'number', example: 400 } },
            required: ['cost_of_goods_sold'],
          },
          gross_profit: {
            type: 'object',
            description: 'Ingresos de operación menos costo de ventas.',
            properties: { amount: { type: 'number', example: 520 } },
            required: ['amount'],
          },
          operating_expenses: {
            type: 'object',
            description: 'Gastos de distribución (95) y de administración (94).',
            properties: {
              distribution: { type: 'number', example: 60 },
              administrative: { type: 'number', example: 100 },
              total: { type: 'number', example: 160 },
            },
            required: ['distribution', 'administrative', 'total'],
          },
          operating_profit: {
            type: 'object',
            description: 'Margen bruto menos gastos de operación.',
            properties: { amount: { type: 'number', example: 360 } },
            required: ['amount'],
          },
          other_revenues_and_expenses: {
            type: 'object',
            description: 'Otro ingreso (75, 76) menos otro gasto (65, 66).',
            properties: {
              revenues: { type: 'number', example: 500 },
              expenses: { type: 'number', example: 0 },
              total: { type: 'number', example: 500 },
            },
            required: ['revenues', 'expenses', 'total'],
          },
          exchange_difference_net: {
            type: 'object',
            description: 'Cuenta 776 (acreedora) menos Cuenta 676 (deudora).',
            properties: { amount: { type: 'number', example: 5 } },
            required: ['amount'],
          },
          financial_income: {
            type: 'object',
            description: 'Cuenta 77 distinta de 776.',
            properties: { amount: { type: 'number', example: 20 } },
            required: ['amount'],
          },
          financial_expenses: {
            type: 'object',
            description: 'Cuenta 67 distinta de 676.',
            properties: { amount: { type: 'number', example: 15 } },
            required: ['amount'],
          },
          result_before_taxes: {
            type: 'object',
            description:
              'Beneficio operativo + otros ingresos y gastos + diferencia de cambio + ingresos financieros − gastos financieros.',
            properties: { amount: { type: 'number', example: 870 } },
            required: ['amount'],
          },
          income_tax_expense: {
            type: 'object',
            description: 'Saldo deudor de la Cuenta 88.',
            properties: { amount: { type: 'number', example: 100 } },
            required: ['amount'],
          },
          net_profit: {
            type: 'object',
            description: 'Resultado antes de impuestos menos impuesto a la renta.',
            properties: { amount: { type: 'number', example: 770 } },
            required: ['amount'],
          },
          period: {
            type: 'object',
            description: 'Rango de fechas efectivamente consultado (inclusivo).',
            properties: {
              start_date: { type: 'string', format: 'date', example: '2026-01-01' },
              end_date: { type: 'string', format: 'date', example: '2026-01-31' },
            },
            required: ['start_date', 'end_date'],
          },
          currency: { type: 'string', description: 'Moneda del reporte.', example: 'PEN' },
        },
        required: [
          'operating_income',
          'sales_costs',
          'gross_profit',
          'operating_expenses',
          'operating_profit',
          'other_revenues_and_expenses',
          'exchange_difference_net',
          'financial_income',
          'financial_expenses',
          'result_before_taxes',
          'income_tax_expense',
          'net_profit',
          'period',
          'currency',
        ],
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
