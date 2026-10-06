/**
 * Servicio frontend para Gestión y Control de Sesiones de Caja (Apertura y Cierre).
 */

export interface ActiveCashSessionData {
  id: number;
  cashRegisterId: number;
  openedAt: string;
  openedBy: string;
  initialAmount: number;
  salesCash: number;
  salesOther: number;
  totalSales: number;
  expectedAmount: number;
  notesOpening: string;
  status: "OPEN" | "CLOSED";
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
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  status: "CLOSED";
  notesClosing: string;
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
 * Abre una nueva sesión de caja con un monto inicial en efectivo.
 */
export async function openCashSession(data: {
  initialAmount: number;
  notesOpening?: string;
}): Promise<{ message: string; session: ActiveCashSessionData }> {
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
 * Realiza el arqueo y cierre de la sesión de caja activa.
 */
export async function closeCashSession(
  sessionId: number,
  data: {
    countedAmount: number;
    notesClosing?: string;
  }
): Promise<{ message: string; audit: CloseCashAudit }> {
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
