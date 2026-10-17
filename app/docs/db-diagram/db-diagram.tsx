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
	/** Entity that owns the foreign key. */
	child: string;
	/** Foreign-key field on `child` (the blue link row). */
	fk: string;
	/** Referenced entity (its `id` row receives the arrow). */
	parent: string;
	label?: string;
}

type EntityNodeData = EntityDef & Record<string, unknown>;

type EntityNode = Node<EntityNodeData, 'entityCard'>;

const ENTITIES: EntityDef[] = [
	{
		id: 'RolePermission', label: 'RolePermission', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'permissionId', type: 'Int', kind: 'fk' },
			{ name: 'roleId', type: 'Int', kind: 'fk' },
		],
	},
	{
		id: 'Role', label: 'Role', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'active', type: 'Boolean', kind: 'field' },
			{ name: 'isSystem', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'Permission', label: 'Permission', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'code', type: 'String', kind: 'field' },
			{ name: 'module', type: 'String', kind: 'field' },
			{ name: 'action', type: 'String', kind: 'field' },
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
			{ name: 'position', type: 'String', kind: 'field', optional: true },
			{ name: 'area', type: 'String', kind: 'field', optional: true },
			{ name: 'contractType', type: 'String', kind: 'field', optional: true },
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
			{ name: 'email', type: 'String', kind: 'field', optional: true },
			{ name: 'password', type: 'String', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
			{ name: 'failedAttempts', type: 'Int', kind: 'field' },
			{ name: 'locked', type: 'Boolean', kind: 'field' },
			{ name: 'lastAccessAt', type: 'Timestamp', kind: 'field', optional: true },
		],
	},
	{
		id: 'AuditLog', label: 'AuditLog', module: 'Seguridad', color: '#6366f1',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'userId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'username', type: 'String', kind: 'field' },
			{ name: 'action', type: 'AuditAction', kind: 'field' },
			{ name: 'module', type: 'String', kind: 'field' },
			{ name: 'entity', type: 'String', kind: 'field' },
			{ name: 'entityId', type: 'String', kind: 'field', optional: true },
			{ name: 'description', type: 'String', kind: 'field' },
			{ name: 'details', type: 'Json', kind: 'field', optional: true },
			{ name: 'createdAt', type: 'Timestamp', kind: 'field' },
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
			{ name: 'overtimePay', type: 'Decimal', kind: 'field' },
			{ name: 'bonus', type: 'Decimal', kind: 'field' },
			{ name: 'deductions', type: 'Decimal', kind: 'field' },
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
			{ name: 'receivedById', type: 'Int', kind: 'fk', optional: true },
			{ name: 'orderNumber', type: 'String', kind: 'field' },
			{ name: 'issuedAt', type: 'Date', kind: 'field' },
			{ name: 'expectedAt', type: 'Date', kind: 'field', optional: true },
			{ name: 'receivedAt', type: 'Timestamp', kind: 'field' },
			{ name: 'status', type: 'Enum', kind: 'field' },
			{ name: 'subtotal', type: 'Decimal', kind: 'field' },
			{ name: 'igv', type: 'Decimal', kind: 'field' },
			{ name: 'total', type: 'Decimal', kind: 'field' },
		],
	},
	{
		id: 'Product', label: 'Product', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'name', type: 'String', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field', optional: true },
			{ name: 'type', type: 'ProductType', kind: 'field' },
			{ name: 'affectationIgv', type: 'AffectationIgv', kind: 'field', optional: true },
			{ name: 'unitOfMeasure', type: 'String', kind: 'field' },
			{ name: 'currentStock', type: 'Decimal', kind: 'field' },
			{ name: 'minimumStock', type: 'Decimal', kind: 'field' },
			{ name: 'lastCost', type: 'Decimal', kind: 'field' },
			{ name: 'averageCost', type: 'Decimal', kind: 'field' },
			{ name: 'price', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'sellable', type: 'Boolean', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'PurchaseOrderItem', label: 'PurchaseOrderItem', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'purchaseOrderId', type: 'Int', kind: 'fk' },
			{ name: 'productId', type: 'Int', kind: 'fk' },
			{ name: 'quantityOrdered', type: 'Decimal', kind: 'field' },
			{ name: 'quantityReceived', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'unitPrice', type: 'Decimal', kind: 'field' },
			{ name: 'affectationIgvApplied', type: 'AffectationIgv', kind: 'field' },
			{ name: 'subtotalLine', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'igvLine', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'finalAmountLine', type: 'Decimal', kind: 'field', optional: true },
		],
	},
	{
		id: 'InventoryMovement', label: 'InventoryMovement', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'productId', type: 'Int', kind: 'fk' },
			{ name: 'purchaseOrderItemId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'transformationItemId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'orderItemId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'informalPurchaseId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'movementType', type: 'Enum', kind: 'field' },
			{ name: 'quantity', type: 'Decimal', kind: 'field' },
			{ name: 'unitCost', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'reason', type: 'String', kind: 'field', optional: true },
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
			{ name: 'issuedAt', type: 'Date', kind: 'field' },
			{ name: 'subtotal', type: 'Decimal', kind: 'field' },
			{ name: 'igv', type: 'Decimal', kind: 'field' },
			{ name: 'totalAmount', type: 'Decimal', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
		],
	},
	{
		id: 'PurchasePayment', label: 'PurchasePayment', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'purchaseInvoiceId', type: 'Int', kind: 'fk' },
			{ name: 'paymentTypeId', type: 'Int', kind: 'fk' },
			{ name: 'amount', type: 'Decimal', kind: 'field' },
			{ name: 'paidAt', type: 'Timestamp', kind: 'field' },
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
			{ name: 'annulled', type: 'Boolean', kind: 'field' },
			{ name: 'annulledAt', type: 'Timestamp', kind: 'field', optional: true },
			{ name: 'annulledById', type: 'Int', kind: 'fk', optional: true },
			{ name: 'annulmentReason', type: 'String', kind: 'field', optional: true },
		],
	},
	{
		id: 'TransformationItem', label: 'TransformationItem', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'transformationId', type: 'Int', kind: 'fk' },
			{ name: 'productId', type: 'Int', kind: 'fk' },
			{ name: 'itemType', type: 'String', kind: 'field' },
			{ name: 'quantity', type: 'Decimal', kind: 'field' },
			{ name: 'unitCost', type: 'Decimal', kind: 'field', optional: true },
		],
	},
	{
		id: 'InformalPurchase', label: 'InformalPurchase', module: 'Compras', color: '#f59e0b',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'productId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'employeeId', type: 'Int', kind: 'fk' },
			{ name: 'purchaseType', type: 'InformalPurchaseType', kind: 'field' },
			{ name: 'expenseCategory', type: 'ExpenseCategory', kind: 'field', optional: true },
			{ name: 'itemDescription', type: 'String', kind: 'field', optional: true },
			{ name: 'quantity', type: 'Decimal', kind: 'field' },
			{ name: 'amountPaid', type: 'Decimal', kind: 'field' },
			{ name: 'date', type: 'Date', kind: 'field' },
			{ name: 'annulled', type: 'Boolean', kind: 'field' },
			{ name: 'annulledById', type: 'Int', kind: 'fk', optional: true },
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
		id: 'ProductRecipe', label: 'ProductRecipe', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'productId', type: 'Int', kind: 'fk' },
			{ name: 'ingredientId', type: 'Int', kind: 'fk' },
			{ name: 'quantityRequired', type: 'Decimal', kind: 'field' },
			{ name: 'active', type: 'Boolean', kind: 'field' },
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
		id: 'OrderTable', label: 'OrderTable', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'tableId', type: 'Int', kind: 'fk' },
			{ name: 'orderId', type: 'Int', kind: 'fk' },
			{ name: 'notes', type: 'String', kind: 'field', optional: true },
		],
	},
	{
		id: 'OrderItem', label: 'OrderItem', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'orderId', type: 'Int', kind: 'fk' },
			{ name: 'productId', type: 'Int', kind: 'fk' },
			{ name: 'quantity', type: 'Int', kind: 'field' },
			{ name: 'unitPrice', type: 'Decimal', kind: 'field' },
			{ name: 'subtotal', type: 'Decimal', kind: 'field' },
			{ name: 'itemStatus', type: 'String', kind: 'field' },
			{ name: 'notes', type: 'String', kind: 'field', optional: true },
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
			{ name: 'number', type: 'Int', kind: 'field' },
			{ name: 'issuedAt', type: 'Date', kind: 'field' },
			{ name: 'subtotal', type: 'Decimal', kind: 'field' },
			{ name: 'igv', type: 'Decimal', kind: 'field' },
			{ name: 'totalAmount', type: 'Decimal', kind: 'field' },
			{ name: 'status', type: 'String', kind: 'field' },
			{ name: 's3Url', type: 'String', kind: 'field', optional: true },
		],
	},
	{
		id: 'SalesPayment', label: 'SalesPayment', module: 'Ventas', color: '#ec4899',
		fields: [
			{ name: 'id', type: 'Int', kind: 'pk' },
			{ name: 'salesInvoiceId', type: 'Int', kind: 'fk' },
			{ name: 'paymentTypeId', type: 'Int', kind: 'fk' },
			{ name: 'amount', type: 'Decimal', kind: 'field' },
			{ name: 'paidAt', type: 'Timestamp', kind: 'field' },
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
			{ name: 'closedAt', type: 'DateTime', kind: 'field', optional: true },
			{ name: 'closedById', type: 'Int', kind: 'fk', optional: true },
			{ name: 'userId', type: 'Int', kind: 'fk', optional: true },
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
			{ name: 'transformationId', type: 'Int', kind: 'fk', optional: true },
			{ name: 'entryDate', type: 'Date', kind: 'field' },
			{ name: 'description', type: 'String', kind: 'field' },
			{ name: 'book', type: 'String', kind: 'field' },
			{ name: 'responsible', type: 'String', kind: 'field', optional: true },
			{ name: 'status', type: 'Boolean', kind: 'field' },
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
			{ name: 'closedAt', type: 'Timestamp', kind: 'field', optional: true },
			{ name: 'initialAmount', type: 'Decimal', kind: 'field' },
			{ name: 'salesCash', type: 'Decimal', kind: 'field' },
			{ name: 'salesOther', type: 'Decimal', kind: 'field' },
			{ name: 'totalSales', type: 'Decimal', kind: 'field' },
			{ name: 'expectedAmount', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'countedAmount', type: 'Decimal', kind: 'field', optional: true },
			{ name: 'difference', type: 'Decimal', kind: 'field', optional: true },
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
	{ id: 're-rp-role', child: 'RolePermission', fk: 'roleId', parent: 'Role', label: 'has' },
	{ id: 're-rp-perm', child: 'RolePermission', fk: 'permissionId', parent: 'Permission', label: 'has' },
	{ id: 're-user-role', child: 'User', fk: 'roleId', parent: 'Role', label: 'has' },
	{ id: 're-user-emp', child: 'User', fk: 'employeeId', parent: 'Employee', label: 'has' },
	{ id: 're-audit-user', child: 'AuditLog', fk: 'userId', parent: 'User', label: 'logs' },
	{ id: 're-emp-shift', child: 'Employee', fk: 'shiftId', parent: 'Shift', label: 'works_in' },
	{ id: 're-payroll-emp', child: 'Payroll', fk: 'employeeId', parent: 'Employee', label: 'earns' },
	{ id: 're-po-supplier', child: 'PurchaseOrder', fk: 'supplierId', parent: 'Supplier', label: 'products' },
	{ id: 're-po-emp', child: 'PurchaseOrder', fk: 'employeeId', parent: 'Employee', label: 'creates' },
	{ id: 're-po-received', child: 'PurchaseOrder', fk: 'receivedById', parent: 'Employee', label: 'receives' },
	{ id: 're-poi-po', child: 'PurchaseOrderItem', fk: 'purchaseOrderId', parent: 'PurchaseOrder', label: 'contains' },
	{ id: 're-poi-product', child: 'PurchaseOrderItem', fk: 'productId', parent: 'Product', label: 'used_in' },
	{ id: 're-inv-product', child: 'InventoryMovement', fk: 'productId', parent: 'Product', label: 'moved_by' },
	{ id: 're-inv-poi', child: 'InventoryMovement', fk: 'purchaseOrderItemId', parent: 'PurchaseOrderItem', label: 'tracks' },
	{ id: 're-inv-ti', child: 'InventoryMovement', fk: 'transformationItemId', parent: 'TransformationItem', label: 'tracks' },
	{ id: 're-inv-inf', child: 'InventoryMovement', fk: 'informalPurchaseId', parent: 'InformalPurchase', label: 'tracks' },
	{ id: 're-inv-oi', child: 'InventoryMovement', fk: 'orderItemId', parent: 'OrderItem', label: 'consumes' },
	{ id: 're-pinv-supplier', child: 'PurchaseInvoice', fk: 'supplierId', parent: 'Supplier', label: 'invoices' },
	{ id: 're-pinv-po', child: 'PurchaseInvoice', fk: 'purchaseOrderId', parent: 'PurchaseOrder', label: 'billed_by' },
	{ id: 're-ppay-pinv', child: 'PurchasePayment', fk: 'purchaseInvoiceId', parent: 'PurchaseInvoice', label: 'paid_by' },
	{ id: 're-ppay-type', child: 'PurchasePayment', fk: 'paymentTypeId', parent: 'PaymentType', label: 'method' },
	{ id: 're-emp-transf', child: 'Transformation', fk: 'employeeId', parent: 'Employee', label: 'performs' },
	{ id: 're-transf-annulled', child: 'Transformation', fk: 'annulledById', parent: 'Employee', label: 'annulled_by' },
	{ id: 're-ti-transf', child: 'TransformationItem', fk: 'transformationId', parent: 'Transformation', label: 'contains' },
	{ id: 're-ti-product', child: 'TransformationItem', fk: 'productId', parent: 'Product', label: 'transformed_in' },
	{ id: 're-inf-product', child: 'InformalPurchase', fk: 'productId', parent: 'Product', label: 'purchased_as' },
	{ id: 're-inf-emp', child: 'InformalPurchase', fk: 'employeeId', parent: 'Employee', label: 'registers' },
	{ id: 're-inf-annulled', child: 'InformalPurchase', fk: 'annulledById', parent: 'Employee', label: 'annulled_by' },
	{ id: 're-recipe-product', child: 'ProductRecipe', fk: 'productId', parent: 'Product', label: 'recipe_of' },
	{ id: 're-recipe-ingredient', child: 'ProductRecipe', fk: 'ingredientId', parent: 'Product', label: 'ingredient' },
	{ id: 're-ot-order', child: 'OrderTable', fk: 'orderId', parent: 'SalesOrder', label: 'serves' },
	{ id: 're-ot-table', child: 'OrderTable', fk: 'tableId', parent: 'DiningTable', label: 'seats' },
	{ id: 're-oi-order', child: 'OrderItem', fk: 'orderId', parent: 'SalesOrder', label: 'includes' },
	{ id: 're-oi-product', child: 'OrderItem', fk: 'productId', parent: 'Product', label: 'ordered_in' },
	{ id: 're-sinv-order', child: 'SalesInvoice', fk: 'orderId', parent: 'SalesOrder', label: 'from' },
	{ id: 're-sinv-customer', child: 'SalesInvoice', fk: 'customerId', parent: 'Customer', label: 'receives' },
	{ id: 're-sinv-session', child: 'SalesInvoice', fk: 'cashSessionId', parent: 'CashSession', label: 'in_session' },
	{ id: 're-spay-sinv', child: 'SalesPayment', fk: 'salesInvoiceId', parent: 'SalesInvoice', label: 'paid_by' },
	{ id: 're-spay-type', child: 'SalesPayment', fk: 'paymentTypeId', parent: 'PaymentType', label: 'method' },
	{ id: 're-je-period', child: 'JournalEntry', fk: 'periodId', parent: 'AccountingPeriod', label: 'contains' },
	{ id: 're-period-closed', child: 'AccountingPeriod', fk: 'closedById', parent: 'User', label: 'closes' },
	{ id: 're-period-user', child: 'AccountingPeriod', fk: 'userId', parent: 'User', label: 'owned_by' },
	{ id: 're-je-sinv', child: 'JournalEntry', fk: 'salesInvoiceId', parent: 'SalesInvoice', label: 'generates' },
	{ id: 're-je-pinv', child: 'JournalEntry', fk: 'purchaseInvoiceId', parent: 'PurchaseInvoice', label: 'generates' },
	{ id: 're-je-payroll', child: 'JournalEntry', fk: 'payrollId', parent: 'Payroll', label: 'generates' },
	{ id: 're-je-transf', child: 'JournalEntry', fk: 'transformationId', parent: 'Transformation', label: 'generates' },
	{ id: 're-jed-je', child: 'JournalEntryDetail', fk: 'entryId', parent: 'JournalEntry', label: 'has' },
	{ id: 're-jed-acc', child: 'JournalEntryDetail', fk: 'accountId', parent: 'AccountingAccount', label: 'records' },
	{ id: 're-session-reg', child: 'CashSession', fk: 'cashRegisterId', parent: 'CashRegister', label: 'has' },
	{ id: 're-session-open', child: 'CashSession', fk: 'openedById', parent: 'User', label: 'opened_by' },
	{ id: 're-session-close', child: 'CashSession', fk: 'closedById', parent: 'User', label: 'closed_by' },
	{ id: 're-movement-session', child: 'CashMovement', fk: 'sessionId', parent: 'CashSession', label: 'has' },
];

const MODULE_LAYOUT: Record<string, { col: number; rows: string[] }> = {
	S0: { col: -4, rows: ['__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', 'TransformationItem'] },
	S1: { col: -3, rows: ['__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', 'ProductRecipe'] },
	S2: { col: -2, rows: ['__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', 'Shift', 'Transformation', 'Product',] },
	S: { col: -1, rows: ['RolePermission', '__SPACER__', '__SPACER__', 'Employee', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', 'InventoryMovement', '__SPACER__', '__SPACER__', '__SPACER__'] },
	Seguridad: { col: 0, rows: ['Permission', 'Role', '__SPACER__', '__SPACER__', '__SPACER__', 'InformalPurchase', 'PurchaseOrderItem',] },
	RRHH: { col: 1, rows: ['CashRegister', 'User', 'Payroll', 'PurchaseOrder', '__SPACER__', '__SPACER__', 'OrderItem',] },
	Compras: { col: 2, rows: ['CashSession', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', '__SPACER__', 'Supplier', 'SalesOrder'] },
	Ventas: { col: 3, rows: ['CashMovement', '__SPACER__', '__SPACER__', '__SPACER__', 'SalesInvoice', 'PurchaseInvoice'] },
	Contabilidad: { col: 4, rows: ['DiningTable', 'Customer', 'JournalEntry', '__SPACER__', 'JournalEntryDetail',] },
	Caja: { col: 5, rows: ['PaymentType', '__SPACER__', 'AccountingPeriod', '__SPACER__', '__SPACER__', 'AccountingAccount'] },
	C3: { col: 6, rows: ['AuditLog', '__SPACER__', 'PurchasePayment', 'SalesPayment', '__SPACER__', 'OrderTable'] },
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

function handleId(entity: string, field: string, side: 'left' | 'right', kind: 's' | 't') {
	return `${entity}.${field}-${side}-${kind}`;
}

/** Arrows go from the FK row of the child to the `id` row of the parent, on the sides that face each other. */
function buildEdges(nodes: Node[]): Edge[] {
	const x = new Map(nodes.map((n) => [n.id, n.position.x]));
	const width = COL_WIDTH - 16;
	return RELATIONS.map((rel) => {
		const cx = x.get(rel.child) ?? 0;
		const px = x.get(rel.parent) ?? 0;
		let childSide: 'left' | 'right' = 'right';
		let parentSide: 'left' | 'right' = 'right';
		if (cx + width < px) {
			childSide = 'right';
			parentSide = 'left';
		} else if (px + width < cx) {
			childSide = 'left';
			parentSide = 'right';
		}
		return {
			id: rel.id,
			source: rel.child,
			sourceHandle: handleId(rel.child, rel.fk, childSide, 's'),
			target: rel.parent,
			targetHandle: handleId(rel.parent, 'id', parentSide, 't'),
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
		};
	});
}

function nodeHeight(entity: EntityDef) {
	return HEADER_HEIGHT + entity.fields.length * FIELD_HEIGHT + 8;
}

function buildInitialNodes(): EntityNode[] {
	const nodes: EntityNode[] = [];
	for (const [, layout] of Object.entries(MODULE_LAYOUT)) {
		let y = ROW_START;
		for (const entityId of layout.rows) {
			if (entityId === '__SPACER__') {
				y += 100;
				continue;
			}

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
						{(field.kind === 'fk' || field.kind === 'pk') && (['left', 'right'] as const).map((side) => (
							<span key={side}>
								<Handle type="source" position={side === 'left' ? Position.Left : Position.Right} id={handleId(entity.id, field.name, side, 's')} className="!pointer-events-none !size-0 !border-0 !opacity-0" />
								<Handle type="target" position={side === 'left' ? Position.Left : Position.Right} id={handleId(entity.id, field.name, side, 't')} className="!pointer-events-none !size-0 !border-0 !opacity-0" />
							</span>
						))}
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

const [nodes, , onNodesChange] = useNodesState<Node>(initialNodes);
	const edges = useMemo(() => buildEdges(nodes), [nodes]);

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
							className="border! border-border! bg-surface-raised! !shadow-xs [&>button]:!bg-surface-raised [&>button]:!text-text [&>button:hover]:!bg-surface"
						/>
						<MiniMap
							position="top-right"
							pannable
							zoomable
							maskStrokeColor="var(--color-accent)"
							maskStrokeWidth={1.5}
							nodeColor={() => 'var(--color-border)'}
							nodeStrokeColor="transparent"
							className="!border border-border! !bg-surface-raised !shadow-sm"
						/>
					</ReactFlow>
				</ReactFlowProvider>
			</div>
		</div>
	);
}