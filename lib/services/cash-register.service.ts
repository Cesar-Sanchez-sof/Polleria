/**
 * Servicio frontend para Gestión y Control de Sesiones de Caja (Apertura, Cierre, Arqueo de Billetes y Monedas, y Salidas de Emergencia).
 */

export interface CashDenominations {
  bills: {
    b200: number; // Billetes de S/ 200
    b100: number; // Billetes de S/ 100
    b50: number;  // Billetes de S/ 50
    b20: number;  // Billetes de S/ 20
    b10: number;  // Billetes de S/ 10
  };
  coins: {
    c5: number;   // Monedas de S/ 5.00
    c2: number;   // Monedas de S/ 2.00
    c1: number;   // Monedas de S/ 1.00
    c05: number;  // Monedas de S/ 0.50 (50 céntimos)
    c02: number;  // Monedas de S/ 0.20 (20 céntimos)
    c01: number;  // Monedas de S/ 0.10 (10 céntimos)
  };
}

export const INITIAL_DENOMINATIONS: CashDenominations = {
  bills: { b200: 0, b100: 0, b50: 0, b20: 0, b10: 0 },
  coins: { c5: 0, c2: 0, c1: 0, c05: 0, c02: 0, c01: 0 },
};

export function calculateDenominationsTotal(d: CashDenominations): number {
  const b = d.bills;
  const c = d.coins;
  const billsTotal =
    (Number(b.b200) || 0) * 200 +
    (Number(b.b100) || 0) * 100 +
    (Number(b.b50) || 0) * 50 +
    (Number(b.b20) || 0) * 20 +
    (Number(b.b10) || 0) * 10;

  const coinsTotal =
    (Number(c.c5) || 0) * 5 +
    (Number(c.c2) || 0) * 2 +
    (Number(c.c1) || 0) * 1 +
    (Number(c.c05) || 0) * 0.5 +
    (Number(c.c02) || 0) * 0.2 +
    (Number(c.c01) || 0) * 0.1;

  return Math.round((billsTotal + coinsTotal) * 100) / 100;
}

export function formatDenominationsSummary(d: CashDenominations): string {
  const list: string[] = [];
  if (d.bills.b200) list.push(`${d.bills.b200}x S/ 200`);
  if (d.bills.b100) list.push(`${d.bills.b100}x S/ 100`);
  if (d.bills.b50) list.push(`${d.bills.b50}x S/ 50`);
  if (d.bills.b20) list.push(`${d.bills.b20}x S/ 20`);
  if (d.bills.b10) list.push(`${d.bills.b10}x S/ 10`);

  if (d.coins.c5) list.push(`${d.coins.c5}x S/ 5.00`);
  if (d.coins.c2) list.push(`${d.coins.c2}x S/ 2.00`);
  if (d.coins.c1) list.push(`${d.coins.c1}x S/ 1.00`);
  if (d.coins.c05) list.push(`${d.coins.c05}x S/ 0.50`);
  if (d.coins.c02) list.push(`${d.coins.c02}x S/ 0.20`);
  if (d.coins.c01) list.push(`${d.coins.c01}x S/ 0.10`);

  return list.length > 0 ? list.join(", ") : "Sin desglose";
}

export interface CashMovementItem {
  id: number;
  sessionId: number;
  type: "INCOME" | "EXPENSE";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface ActiveCashSessionData {
  id: number;
  cashRegisterId: number;
  openedAt: string;
  openedBy: string;
  initialAmount: number;
  salesCash: number;
  salesOther: number;
  totalSales: number;
  totalExpenses: number;
  totalIncomes: number;
  expectedAmount: number;
  notesOpening: string;
  status: "OPEN" | "CLOSED";
  movements: CashMovementItem[];
}

export interface CashRegisterStatus {
  isOpened: boolean;
  register: {
    id: number;
    name: string;
    code: string;
    description?: string;
  } | null;
  activeSession: ActiveCashSessionData | null;
}

export interface CloseCashAudit {
  sessionId: number;
  registerName: string;
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  initialAmount: number;
  salesCash: number;
  salesOther: number;
  totalSales: number;
  totalExpenses: number;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  status: "CLOSED";
  notesClosing: string;
  denominationsSummary?: string;
  movements?: CashMovementItem[];
}

/**
 * Consulta el estado actual de la caja y si existe una sesión abierta.
 */
export async function getCashSessionStatus(): Promise<CashRegisterStatus> {
  const res = await fetch("/api/cash-sessions", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo obtener el estado de la caja.");
  }
  return res.json();
}

/**
 * Abre una nueva sesión de caja con un monto inicial en efectivo y desglose opcional de billetes/monedas.
 */
export async function openCashSession(data: {
  initialAmount: number;
  notesOpening?: string;
  denominations?: CashDenominations;
}): Promise<{ message: string; session: ActiveCashSessionData; journalEntryId?: number | null }> {
  const res = await fetch("/api/cash-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo abrir la caja registradora.");
  }
  return res.json();
}

/**
 * Realiza el arqueo y cierre de la sesión de caja activa con desglose de billetes y monedas.
 */
export async function closeCashSession(
  sessionId: number,
  data: {
    countedAmount: number;
    notesClosing?: string;
    denominations?: CashDenominations;
  }
): Promise<{ message: string; audit: CloseCashAudit; journalEntryIds?: number[] }> {
  const res = await fetch(`/api/cash-sessions/${sessionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cerrar la sesión de caja.");
  }
  return res.json();
}

/**
 * Registra una salida de emergencia (o ingreso excepcional) de la caja.
 * Impacta directamente en el arqueo esperado y genera el asiento contable en el libro diario.
 */
export async function registerCashMovement(data: {
  sessionId: number;
  type: "EXPENSE" | "INCOME";
  amount: number;
  reason: string;
}): Promise<{ message: string; movement: CashMovementItem; journalEntryId?: number }> {
  const res = await fetch("/api/cash-sessions/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo registrar la salida de caja.");
  }
  return res.json();
}

