'use client';

import '@xyflow/react/dist/style.css';
import {
	Background,
	Controls,
	type Edge,
	Handle,
	MarkerType,
	MiniMap,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
} from '@xyflow/react';
import { Database, Key, Link } from 'lucide-react';
import { useMemo } from 'react';

type FieldKind = 'pk' | 'fk' | 'field';

interface SchemaField {
	name: string;
	type: string;
	kind: FieldKind;
	optional?: boolean;
}

interface EntityDef {
	id: string;
	label: string;
	module: string;
	color: string;
	fields: SchemaField[];
}

interface RelationDef {
	id: string;
	source: string;
	target: string;
	label?: string;
}

type EntityNodeData = EntityDef & Record<string, unknown>;

type EntityNode = Node<EntityNodeData, 'entityCard'>;

const ENTITIES: EntityDef[] = [
	{
		id: 'RolePermission', label: 'RolePermission', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'roleId', type: 'Int', kind: 'fk' },
			{ name: 'permissionId', type: 'Int', kind: 'fk' },
		],
	},
	{
		id: 'Role', label: 'Role', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'Permission', label: 'Permission', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
		],
	},
	{
		id: 'Shift', label: 'Shift', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'date', type: 'Date', kind: 'field' },
			{ name: 'startTime', type: 'Time', kind: 'field' },
			{ name: 'endTime', type: 'Time', kind: 'field' },
		],
	},
	{
		id: 'Employee', label: 'Employee', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'shiftId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'dni', type: 'String', kind: 'field' },
			{ name: 'firstName', type: 'String', kind: 'field' },
			{ name: 'paternalLastName', type: 'String', kind: 'field' },
			{ name: 'baseSalary', type: 'Decimal', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'User', label: 'User (app_user)', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'roleId', type: 'Int', kind: 'fk' },
			{ name: 'username', type: 'String', kind: 'field' },
			{ name: 'correo', type: 'String', kind: 'field', optional: true },
			{ name: 'password', type: 'String', kind: 'field' },
			{ name: 'estado', type: 'Boolean', kind: 'field' },
			{ name: 'locked', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'Payroll', label: 'Payroll', module: 'RRHH', color: '#8b5cf6',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'month', type: 'Int', kind: 'field' },
			{ name: 'year', type: 'Int', kind: 'field' },
			{ name: 'baseSalary', type: 'Decimal', kind: 'field' },
			{ name: 'netPay', type: 'Decimal', kind: 'field' },
			{ name: 'paymentDate', type: 'Date', kind: 'field', optional: true },
		],
	},
	{
		id: 'Supplier', label: 'Supplier', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'ruc', type: 'String', kind: 'field' },
			{ name: 'businessName', type: 'String', kind: 'field' },
			{ name: 'contactPerson', type: 'String', kind: 'field', optional: true },
			{ name: 'phone', type: 'String', kind: 'field', optional: true },
			{ name: 'email', type: 'String', kind: 'field', optional: true },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'PurchaseOrder', label: 'PurchaseOrder', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'supplierId', type: 'Int', kind: 'fk' },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'orderNumber', type: 'String', kind: 'field' },
			{ name: 'issuedAt', type: 'Date', kind: 'field' },
			{ name: 'status', type: 'Enum', kind: 'field' },
			{ name: 'total', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'Supply', label: 'Supply', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'type', type: 'SupplyType', kind: 'field' },
			{ name: 'unitOfMeasure', type: 'String', kind: 'field' },
			{ name: 'currentStock', type: 'Decimal', kind: 'field' },
			{ name: 'minimumStock', type: 'Decimal', kind: 'field' },
			{ name: 'averageCost', type: 'Decimal', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'PurchaseOrderItem', label: 'PurchaseOrderItem', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'purchaseOrderId', type: 'Int', kind: 'fk' },
			{ name: 'supplyId', type: 'Int', kind: 'fk' },
			{ name: 'quantityOrdered', type: 'Decimal', kind: 'field' },
			{ name: 'quantityReceived', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'unitPrice', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'InventoryMovement', label: 'InventoryMovement', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'supplyId', type: 'Int', kind: 'fk' },
			{ name: 'purchaseOrderItemId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'orderItemId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'movementType', type: 'Enum', kind: 'field' },
			{ name: 'quantity', type: 'Decimal', kind: 'field' },
			{ name: 'movedAt', type: 'Timestamp', kind: 'field' },
		],
	},
	{
		id: 'PurchaseInvoice', label: 'PurchaseInvoice', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'supplierId', type: 'Int', kind: 'fk' },
			{ name: 'purchaseOrderId', type: 'Int', kind: 'fk' },
			{ name: 'voucherType', type: 'String', kind: 'field' },
			{ name: 'series', type: 'String', kind: 'field' },
			{ name: 'number', type: 'Int', kind: 'field' },
			{ name: 'totalAmount', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'PaymentType', label: 'PaymentType', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'Transformation', label: 'Transformation', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'date', type: 'Timestamp', kind: 'field' },
			{ name: 'notes', type: 'String', kind: 'field', optional: true },
		],
	},
	{
		id: 'InformalPurchase', label: 'InformalPurchase', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'supplyId', type: 'Int', kind: 'fk' },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'quantity', type: 'Decimal', kind: 'field' },
			{ name: 'amountPaid', type: 'Decimal', kind: 'field' },
			{ name: 'date', type: 'Date', kind: 'field' },
		],
	},
	{
		id: 'Customer', label: 'Customer', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'documentNumber', type: 'String', kind: 'field' },
			{ name: 'firstName', type: 'String', kind: 'field' },
			{ name: 'lastName', type: 'String', kind: 'field', optional: true },
			{ name: 'phone', type: 'String', kind: 'field', optional: true },
			{ name: 'personType', type: 'PersonType', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'DiningTable', label: 'DiningTable', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'number', type: 'Int', kind: 'field' },
			{ name: 'capacity', type: 'Int', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'Dish', label: 'Dish', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'price', type: 'Decimal', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'DishRecipe', label: 'DishRecipe', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'dishId', type: 'Int', kind: 'fk' },
			{ name: 'supplyId', type: 'Int', kind: 'fk' },
			{ name: 'quantityRequired', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'SalesOrder', label: 'SalesOrder', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'code', type: 'String', kind: 'field' },
			{ name: 'orderType', type: 'String', kind: 'field' },
			{ name: 'orderedAt', type: 'Timestamp', kind: 'field' },
			{ name: 'status', type: 'String', kind: 'field' },
		],
	},
	{
		id: 'OrderItem', label: 'OrderItem', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'orderId', type: 'Int', kind: 'fk' },
			{ name: 'dishId', type: 'Int', kind: 'fk' },
			{ name: 'quantity', type: 'Int', kind: 'field' },
			{ name: 'unitPrice', type: 'Decimal', kind: 'field' },
			{ name: 'subtotal', type: 'Decimal', kind: 'field' },
			{ name: 'dishStatus', type: 'String', kind: 'field' },
		],
	},
	{
		id: 'SalesInvoice', label: 'SalesInvoice', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'orderId', type: 'Int', kind: 'fk' },
			{ name: 'customerId', type: 'Int', kind: 'fk' },
			{ name: 'cashSessionId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'voucherType', type: 'String', kind: 'field' },
			{ name: 'series', type: 'String', kind: 'field' },
			{ name: 'totalAmount', type: 'Decimal', kind: 'field' },
			{ name: 'status', type: 'String', kind: 'field' },
		],
	},
	{
		id: 'AccountingAccount', label: 'AccountingAccount', module: 'Contabilidad', color: '#10b981', //#8b5cf6
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'parentId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'code', type: 'String', kind: 'field' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'type', type: 'String', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'AccountingPeriod', label: 'AccountingPeriod', module: 'Contabilidad', color: '#10b981',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'startDate', type: 'DateTime', kind: 'field' },
			{ name: 'endDate', type: 'DateTime', kind: 'field' },
			{ name: 'status', type: 'PeriodStatus', kind: 'field' },
			{ name: 'closedById', type: 'Int', kind: 'fk', optional: true },
		],
	},
	{
		id: 'JournalEntry', label: 'JournalEntry', module: 'Contabilidad', color: '#10b981',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'periodId', type: 'Int', kind: 'fk' },
			{ name: 'salesInvoiceId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'purchaseInvoiceId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'payrollId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'entryDate', type: 'Date', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field' },
			{ name: 'code', type: 'String', kind: 'field' },
		],
	},
	{
		id: 'JournalEntryDetail', label: 'JournalEntryDetail', module: 'Contabilidad', color: '#10b981',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'entryId', type: 'Int', kind: 'fk' },
			{ name: 'accountId', type: 'Int', kind: 'fk' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'debit', type: 'Decimal', kind: 'field' },
			{ name: 'credit', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'CashRegister', label: 'CashRegister', module: 'Caja', color: '#ef4444',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'code', type: 'String', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'CashSession', label: 'CashSession', module: 'Caja', color: '#ef4444',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'cashRegisterId', type: 'Int', kind: 'fk' },
			{ name: 'openedById', type: 'Int', kind: 'fk' },
			{ name: 'closedById', type: 'Int', kind: 'fk', optional: true },
			{ name: 'openedAt', type: 'Timestamp', kind: 'field' },
			{ name: 'initialAmount', type: 'Decimal', kind: 'field' },
			{ name: 'totalSales', type: 'Decimal', kind: 'field' },
			{ name: 'status', type: 'CashSessionStatus', kind: 'field' },
		],
	},
	{
		id: 'CashMovement', label: 'CashMovement', module: 'Caja', color: '#ef4444', //#14b8a6
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'sessionId', type: 'Int', kind: 'fk' },
			{ name: 'type', type: 'CashMovementType', kind: 'field' },
			{ name: 'amount', type: 'Decimal', kind: 'field' },
			{ name: 'reason', type: 'String', kind: 'field' },
			{ name: 'createdAt', type: 'Timestamp', kind: 'field' },
		],
	},
];

const RELATIONS: RelationDef[] = [
	{ id: 're-rp-role', source: 'Role', target: 'RolePermission', label: 'has' },
	{ id: 're-rp-perm', source: 'Permission', target: 'RolePermission', label: 'has' },
	{ id: 're-user-role', source: 'Role', target: 'User', label: 'has' },
	{ id: 're-user-emp', source: 'Employee', target: 'User', label: 'has' },
	{ id: 're-emp-shift', source: 'Shift', target: 'Employee', label: 'works_in' },
	{ id: 're-payroll-emp', source: 'Employee', target: 'Payroll', label: 'earns' },
	{ id: 're-po-supplier', source: 'Supplier', target: 'PurchaseOrder', label: 'supplies' },
	{ id: 're-po-emp', source: 'Employee', target: 'PurchaseOrder', label: 'creates' },
	{ id: 're-poi-po', source: 'PurchaseOrder', target: 'PurchaseOrderItem', label: 'contains' },
	{ id: 're-poi-supply', source: 'Supply', target: 'PurchaseOrderItem', label: 'used_in' },
	{ id: 're-inv-supply', source: 'Supply', target: 'InventoryMovement', label: 'moved_by' },
	{ id: 're-inv-poi', source: 'PurchaseOrderItem', target: 'InventoryMovement', label: 'tracks' },
	{ id: 're-pinv-supplier', source: 'Supplier', target: 'PurchaseInvoice', label: 'invoices' },
	{ id: 're-pinv-po', source: 'PurchaseOrder', target: 'PurchaseInvoice', label: 'billed_by' },
	{ id: 're-transf-emp', source: 'Employee', target: 'Transformation', label: 'performs' },
	{ id: 're-inf-supply', source: 'Supply', target: 'InformalPurchase', label: 'purchased_as' },
	{ id: 're-inf-emp', source: 'Employee', target: 'InformalPurchase', label: 'registers' },
	{ id: 're-recipe-dish', source: 'Dish', target: 'DishRecipe', label: 'has_ingredients' },
	{ id: 're-recipe-supply', source: 'Supply', target: 'DishRecipe', label: 'ingredient_of' },
	{ id: 're-oi-order', source: 'SalesOrder', target: 'OrderItem', label: 'includes' },
	{ id: 're-oi-dish', source: 'Dish', target: 'OrderItem', label: 'ordered_in' },
	{ id: 're-inv-oi', source: 'OrderItem', target: 'InventoryMovement', label: 'consumes' },
	{ id: 're-sinv-order', source: 'SalesOrder', target: 'SalesInvoice', label: 'billed_by' },
	{ id: 're-sinv-customer', source: 'Customer', target: 'SalesInvoice', label: 'receives' },
	{ id: 're-sinv-session', source: 'CashSession', target: 'SalesInvoice', label: 'in_session' },
	{ id: 're-je-period', source: 'AccountingPeriod', target: 'JournalEntry', label: 'contains' },
	{ id: 're-je-sinv', source: 'SalesInvoice', target: 'JournalEntry', label: 'generates' },
	{ id: 're-je-pinv', source: 'PurchaseInvoice', target: 'JournalEntry', label: 'generates' },
	{ id: 're-je-payroll', source: 'Payroll', target: 'JournalEntry', label: 'generates' },
	{ id: 're-jed-je', source: 'JournalEntry', target: 'JournalEntryDetail', label: 'has' },
	{ id: 're-jed-acc', source: 'AccountingAccount', target: 'JournalEntryDetail', label: 'records' },
	{ id: 're-session-reg', source: 'CashRegister', target: 'CashSession', label: 'has' },
	{ id: 're-session-open', source: 'User', target: 'CashSession', label: 'opens' },
	{ id: 're-movement-session', source: 'CashSession', target: 'CashMovement', label: 'has' },
];

const MODULE_LAYOUT: Record<string, { col: number; rows: string[] }> = {
	S: { col: -1, rows: ['RolePermission'] },
	Seguridad: { col: 0, rows: ['Role', 'Permission', 'Shift', 'Employee', 'User'] },
	RRHH: { col: 1, rows: ['Payroll'] },
	Compras: { col: 2, rows: ['Supplier', 'PurchaseOrder', 'PurchaseOrderItem', 'Supply', 'InventoryMovement', 'PurchaseInvoice', 'PaymentType', 'Transformation', 'InformalPurchase'] },
	Ventas: { col: 3, rows: ['Customer', 'DiningTable', 'Dish', 'DishRecipe', 'SalesOrder', 'OrderItem', 'SalesInvoice'] },
	Contabilidad: { col: 4, rows: ['AccountingAccount', 'AccountingPeriod', 'JournalEntry', 'JournalEntryDetail'] },
	Caja: { col: 5, rows: ['CashRegister', 'CashSession', 'CashMovement'] },
};

const MODULE_COLORS: Record<string, string> = {
	Seguridad: '#6366f1',
	RRHH: '#8b5cf6', //#10b981
	Compras: '#f59e0b',
	Ventas: '#ec4899',
	Contabilidad: '#10b981',
	Caja: '#ef4444',
};

const COL_WIDTH = 290;
const COL_GAP = 60;
const ROW_START = 80;
const ROW_GAP = 20;
const FIELD_HEIGHT = 24;
const HEADER_HEIGHT = 48;

function nodeHeight(entity: EntityDef) {
	return HEADER_HEIGHT + entity.fields.length * FIELD_HEIGHT + 8;
}

function buildInitialNodes(): EntityNode[] {
	const nodes: EntityNode[] = [];
	for (const [, layout] of Object.entries(MODULE_LAYOUT)) {
		let y = ROW_START;
		for (const entityId of layout.rows) {
			const entity = ENTITIES.find((e) => e.id === entityId);
			if (!entity) continue;
			nodes.push({
				id: entity.id,
				type: 'entityCard',
				position: { x: layout.col * (COL_WIDTH + COL_GAP), y },
				data: entity as EntityNodeData,
			});
			y += nodeHeight(entity) + ROW_GAP;
		}
	}
	return nodes;
}

function EntityCardNode({ data }: NodeProps) {
	const entity = data as unknown as EntityDef;

	return (
		<div
			className="select-none rounded-xl border border-border bg-surface-raised shadow-sm overflow-hidden"
			style={{ minWidth: COL_WIDTH - 16 }}
		>
			<Handle type="target" position={Position.Left} id={`${entity.id}-left`} className="!pointer-events-none !size-0 !border-0 !opacity-0" />
			<Handle type="source" position={Position.Right} id={`${entity.id}-right`} className="!pointer-events-none !size-0 !border-0 !opacity-0" />
			<Handle type="target" position={Position.Top} id={`${entity.id}-top`} className="!pointer-events-none !size-0 !border-0 !opacity-0" />
			<Handle type="source" position={Position.Bottom} id={`${entity.id}-bottom`} className="!pointer-events-none !size-0 !border-0 !opacity-0" />

			{/* Header */}
			<div
				className="flex cursor-grab items-center gap-2 px-3 py-2.5 active:cursor-grabbing"
				style={{ background: `${entity.color}1a`, borderBottom: `1.5px solid ${entity.color}40` }}
			>
				<span
					className="flex size-5 shrink-0 items-center justify-center rounded-md"
					style={{ background: `${entity.color}25`, color: entity.color }}
				>
					<Database style={{ width: 11, height: 11 }} />
				</span>
				<span className="text-[12px] font-bold tracking-tight" style={{ color: entity.color }}>
					{entity.label}
				</span>
				<span
					className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
					style={{ background: `${entity.color}20`, color: entity.color }}
				>
					{entity.module}
				</span>
			</div>

			{/* Fields */}
			<div className="flex flex-col divide-y divide-border/40">
				{entity.fields.map((field) => (
					<div
						key={field.name}
						className="nodrag relative flex items-center gap-1.5 px-3"
						style={{ height: FIELD_HEIGHT }}
					>
						{field.kind === 'pk' ? (
							<Key style={{ width: 10, height: 10, color: '#fbbf24', flexShrink: 0 }} />
						) : field.kind === 'fk' ? (
							<Link style={{ width: 10, height: 10, color: '#60a5fa', flexShrink: 0 }} />
						) : (
							<span className="size-2 shrink-0 rounded-sm bg-border/70" />
						)}

						<span
							className="truncate text-[11px]"
							style={{
								color: field.kind === 'pk' ? '#fbbf24' : field.kind === 'fk' ? '#60a5fa' : 'var(--color-text)',
								opacity: field.optional ? 0.6 : 1,
								fontFamily: 'monospace',
							}}
						>
							{field.name}
						</span>

						<span
							className="ml-auto shrink-0 text-[10px]"
							style={{ color: 'var(--color-text-disabled)', fontFamily: 'monospace' }}
						>
							{field.type}{field.optional ? '?' : ''}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

const nodeTypes = { entityCard: EntityCardNode };

export function DbDiagram() {
	const initialNodes = useMemo(() => buildInitialNodes(), []);

	const initialEdges: Edge[] = useMemo(() =>
		RELATIONS.map((rel) => ({
			id: rel.id,
			source: rel.source,
			target: rel.target,
			type: 'smoothstep',
			label: rel.label,
			labelStyle: { fontSize: 9, fill: 'var(--color-text-disabled)' },
			labelBgStyle: { fill: 'var(--color-surface)', opacity: 0.85 },
			style: { stroke: 'var(--color-border)', strokeWidth: 1.25 },
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: 'var(--color-border)',
				width: 8,
				height: 8,
			},
		})), []);

	const [nodes, , onNodesChange] = useNodesState<Node>(initialNodes);
	const [edges] = useEdgesState<Edge>(initialEdges);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			{/* Legend */}
			<div className="flex flex-wrap items-center gap-2">
				{Object.entries(MODULE_COLORS).map(([mod, color]) => (
					<span
						key={mod}
						className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
						style={{
							borderColor: `${color}44`,
							background: `${color}11`,
							color,
						}}
					>
						<span className="size-2 rounded-full" style={{ background: color }} />
						{mod}
					</span>
				))}
				<span className="ml-2 flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-disabled)' }}>
					<Key style={{ width: 10, height: 10, color: '#fbbf24' }} /> PK
				</span>
				<span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-disabled)' }}>
					<Link style={{ width: 10, height: 10, color: '#60a5fa' }} /> FK
				</span>
			</div>

			{/* Flow */}
			<div className="flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
				<ReactFlowProvider>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						nodeTypes={nodeTypes}
						fitView
						fitViewOptions={{ padding: 0.1 }}
						minZoom={0.08}
						maxZoom={2}
						nodesDraggable
						nodesConnectable={false}
						elementsSelectable
						proOptions={{ hideAttribution: true }}
						aria-label="Diagrama de base de datos"
					>
						<Background gap={20} color="var(--color-border)" />
						<Controls
							position="bottom-right"
							showInteractive={false}
							className="!border !border-border !bg-surface-raised !shadow-xs [&>button]:!border-border [&>button]:!bg-surface-raised [&>button]:!text-text [&>button:hover]:!bg-surface"
						/>
						<MiniMap
							position="top-right"
							pannable
							zoomable
							maskStrokeColor="var(--color-accent)"
							maskStrokeWidth={1.5}
							nodeColor={() => 'var(--color-border)'}
							nodeStrokeColor="transparent"
							className="!border !border-border !bg-surface-raised !shadow-sm"
						/>
					</ReactFlow>
				</ReactFlowProvider>
			</div>
		</div>
	);
}