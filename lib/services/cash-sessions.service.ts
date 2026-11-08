import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/auth/current-session";
import {
  postCashSessionOpeningJournalEntry,
  postCashMovementExpenseJournalEntry,
  postCashSessionClosingJournalEntries,
} from "@/lib/services/accounting-posting.service";
import {
  formatDenominationsSummary,
  type CashDenominations,
} from "@/lib/services/cash-register.service";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/lib/http/route-handler";

export interface CashRegisterDto {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  active: boolean;
}

export interface CashMovementDto {
  id: number;
  sessionId: number;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface ActiveCashSessionDto {
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
  status: string;
  movements: CashMovementDto[];
}

export interface CashSessionStateResult {
  isOpened: boolean;
  register: CashRegisterDto | null;
  activeSession: ActiveCashSessionDto | null;
  message?: string;
}

export interface OpenCashSessionInput {
  initialAmount?: number;
  notesOpening?: string;
  observations?: string;
  denominations?: CashDenominations;
  userId?: number;
}

export interface CreateCashMovementInput {
  sessionId?: number;
  type?: "INCOME" | "EXPENSE" | string;
  amount?: number;
  reason?: string;
}

export interface CloseCashSessionInput {
  countedAmount?: number;
  notesClosing?: string;
  observations?: string;
  denominations?: CashDenominations;
  userId?: number;
}

/**
 * Asegura la existencia de la caja principal del restaurante.
 */
export async function getOrCreateDefaultCashRegister(): Promise<CashRegisterDto> {
  let register = await (prisma as any).cashRegister.findFirst({
    where: { active: true },
  }).catch(() => null);

  if (!register) {
    try {
      register = await (prisma as any).cashRegister.create({
        data: {
          name: "Caja Principal - Salón",
          code: "CAJA-01",
          description: "Caja registradora principal del salón",
          active: true,
        },
      });
    } catch {
      throw new Error("No se pudo inicializar la caja registradora principal.");
    }
  }

  return register;
}

/**
 * Obtiene el estado de la sesión de caja activa actual y sus métricas.
 */
export async function getCashSessionState(): Promise<CashSessionStateResult> {
  let register: CashRegisterDto;
  try {
    register = await getOrCreateDefaultCashRegister();
  } catch {
    return {
      isOpened: false,
      activeSession: null,
      register: null,
      message: "Módulo de caja en preparación o migración pendiente.",
    };
  }

  const activeSession = await (prisma as any).cashSession.findFirst({
    where: {
      cashRegisterId: register.id,
      status: "OPEN",
    },
    include: {
      openedBy: {
        select: { id: true, username: true },
      },
      movements: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { id: "desc" },
  }).catch(() => null);

  if (!activeSession) {
    return {
      activeSession: null,
      register,
      isOpened: false,
    };
  }

  const initialAmount = Number(activeSession.initialAmount) || 0;
  const salesCash = Number(activeSession.salesCash) || 0;
  const salesOther = Number(activeSession.salesOther) || 0;
  const totalSales = Number(activeSession.totalSales) || (salesCash + salesOther);

  const rawMovements = activeSession.movements || [];
  const totalExpenses = rawMovements
    .filter((m: any) => m.type === "EXPENSE")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
  const totalIncomes = rawMovements
    .filter((m: any) => m.type === "INCOME")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

  const expectedAmount = Math.round((initialAmount + salesCash + totalIncomes - totalExpenses) * 100) / 100;

  const formattedMovements: CashMovementDto[] = rawMovements.map((m: any) => ({
    id: m.id,
    sessionId: m.sessionId,
    type: m.type,
    amount: Number(m.amount),
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  }));

  return {
    isOpened: true,
    register,
    activeSession: {
      id: activeSession.id,
      cashRegisterId: activeSession.cashRegisterId,
      openedAt: activeSession.openedAt.toISOString(),
      openedBy: activeSession.openedBy?.username || "Cajero",
      initialAmount,
      salesCash,
      salesOther,
      totalSales,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalIncomes: Math.round(totalIncomes * 100) / 100,
      expectedAmount,
      notesOpening: activeSession.notesOpening || "",
      status: activeSession.status,
      movements: formattedMovements,
    },
  };
}

/**
 * Resuelve el ID de usuario activo o de respaldo para registrar operaciones de caja.
 */
async function resolveCashSessionUserId(providedUserId?: number): Promise<number> {
  let userId = providedUserId;

  if (!userId) {
    const session = await currentSession().catch(() => null);
    userId = session?.userId;
  }

  if (userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      userId = undefined;
    }
  }

  if (!userId) {
    const fallbackUser =
      (await prisma.user.findFirst({
        where: { active: true },
        select: { id: true },
      })) ||
      (await prisma.user.findFirst({
        select: { id: true },
      }));
    userId = fallbackUser?.id;
  }

  if (!userId) {
    throw new ValidationError(
      "No se encontró ningún usuario registrado en el sistema para asociar la operación de caja."
    );
  }

  return userId;
}

/**
 * Registra la apertura de una nueva sesión de caja física y su asiento contable.
 */
export async function openCashSession(data: OpenCashSessionInput): Promise<{
  message: string;
  session: any;
  journalEntryId: number | null;
}> {
  const userId = await resolveCashSessionUserId(data.userId);
  const initialAmount = Math.max(0, Number(data.initialAmount ?? 0));
  let notesOpening = (data.notesOpening ?? data.observations ?? "").trim();
  const denominations = data.denominations;

  if (denominations && typeof denominations === "object") {
    const denominationsSummary = formatDenominationsSummary(denominations);
    if (denominationsSummary && denominationsSummary !== "Sin desglose") {
      notesOpening = notesOpening
        ? `${notesOpening} | Arqueo: ${denominationsSummary}`
        : `Arqueo Inicial: ${denominationsSummary}`;
    }
  }

  const register = await getOrCreateDefaultCashRegister();

  const existingOpenSession = await (prisma as any).cashSession.findFirst({
    where: {
      cashRegisterId: register.id,
      status: "OPEN",
    },
  });

  if (existingOpenSession) {
    throw new ValidationError(
      `La caja '${register.name}' ya tiene una sesión abierta activa (Sesión #${existingOpenSession.id}). Debe cerrarse antes de iniciar una nueva.`
    );
  }

  const newSession = await (prisma as any).cashSession.create({
    data: {
      cashRegisterId: register.id,
      openedById: userId,
      initialAmount,
      salesCash: 0,
      salesOther: 0,
      totalSales: 0,
      status: "OPEN",
      notesOpening: notesOpening || null,
      openedAt: new Date(),
    },
    include: {
      openedBy: {
        select: { id: true, username: true },
      },
    },
  });

  let journalEntryId: number | null = null;
  try {
    if (initialAmount > 0) {
      journalEntryId = await postCashSessionOpeningJournalEntry(prisma as any, {
        sessionId: newSession.id,
        initialAmount,
        entryDate: newSession.openedAt,
        responsible: newSession.openedBy?.username || "Cajero",
        denominationsSummary: notesOpening || undefined,
      });
    }
  } catch (journalErr) {
    console.warn("[cash-sessions.service] Aviso al generar asiento contable de apertura:", journalErr);
  }

  return {
    message: "Caja abierta exitosamente y comunicada a contabilidad.",
    session: newSession,
    journalEntryId,
  };
}

/**
 * Consulta los movimientos registrados en una sesión de caja.
 */
export async function listCashMovements(sessionId: number): Promise<CashMovementDto[]> {
  if (!sessionId || Number.isNaN(sessionId)) {
    throw new ValidationError("sessionId inválido.");
  }

  const movements = await (prisma as any).cashMovement.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });

  return movements.map((m: any) => ({
    id: m.id,
    sessionId: m.sessionId,
    type: m.type,
    amount: Number(m.amount),
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Registra un egreso o ingreso extraordinario de caja menor.
 */
export async function createCashMovement(data: CreateCashMovementInput): Promise<{
  message: string;
  movement: CashMovementDto;
  journalEntryId: number | null;
}> {
  const sessionId = Number(data.sessionId);
  const amount = Math.round(Number(data.amount ?? 0) * 100) / 100;
  const reason = (data.reason ?? "").trim();
  const type = data.type === "INCOME" ? "INCOME" : "EXPENSE";

  if (!sessionId || Number.isNaN(sessionId)) {
    throw new ValidationError("ID de sesión de caja requerido.");
  }

  if (amount <= 0) {
    throw new ValidationError("El importe debe ser un monto mayor a S/ 0.00.");
  }

  if (!reason || reason.length < 3) {
    throw new ValidationError(
      "Debe especificar el motivo o justificación de la salida de caja (mínimo 3 caracteres)."
    );
  }

  const cashSession = await (prisma as any).cashSession.findUnique({
    where: { id: sessionId },
    include: { movements: true },
  });

  if (!cashSession) {
    throw new NotFoundError("Sesión de caja no encontrada.");
  }

  if (cashSession.status !== "OPEN") {
    throw new ValidationError("No se pueden registrar salidas en una sesión de caja cerrada.");
  }

  const initialAmount = Number(cashSession.initialAmount) || 0;
  const salesCash = Number(cashSession.salesCash) || 0;
  const previousMovements = cashSession.movements || [];
  const prevExpenses = previousMovements
    .filter((m: any) => m.type === "EXPENSE")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
  const prevIncomes = previousMovements
    .filter((m: any) => m.type === "INCOME")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

  const currentCashInDrawer = Math.round((initialAmount + salesCash + prevIncomes - prevExpenses) * 100) / 100;

  if (type === "EXPENSE" && amount > currentCashInDrawer) {
    throw new ValidationError(
      `No hay suficiente efectivo en caja para retirar S/ ${amount.toFixed(2)}. Saldo actual en gaveta: S/ ${currentCashInDrawer.toFixed(2)}.`
    );
  }

  const createdMovement = await (prisma as any).cashMovement.create({
    data: {
      sessionId,
      type,
      amount,
      reason: reason.slice(0, 150),
      createdAt: new Date(),
    },
  });

  let journalEntryId: number | null = null;
  try {
    if (type === "EXPENSE") {
      journalEntryId = await postCashMovementExpenseJournalEntry(prisma as any, {
        sessionId,
        amount,
        reason,
        entryDate: createdMovement.createdAt,
      });
    }
  } catch (journalErr) {
    console.warn("[cash-sessions.service] Aviso al generar asiento contable de gasto:", journalErr);
  }

  return {
    message: type === "EXPENSE" ? "Egreso de caja registrado exitosamente." : "Ingreso de caja registrado exitosamente.",
    movement: {
      id: createdMovement.id,
      sessionId: createdMovement.sessionId,
      type: createdMovement.type,
      amount: Number(createdMovement.amount),
      reason: createdMovement.reason,
      createdAt: createdMovement.createdAt.toISOString(),
    },
    journalEntryId,
  };
}

/**
 * Cierra y arquea una sesión de caja calculando diferencias y disparando asientos de cierre.
 */
export async function closeCashSession(
  sessionId: number,
  data: CloseCashSessionInput
): Promise<{
  message: string;
  journalEntryIds: number[];
  session: any;
  audit: any;
}> {
  if (!sessionId || Number.isNaN(sessionId)) {
    throw new ValidationError("ID de sesión inválido.");
  }

  const userId = await resolveCashSessionUserId(data.userId);
  const countedAmount = Math.max(0, Number(data.countedAmount ?? 0));
  let notesClosing = (data.notesClosing ?? data.observations ?? "").trim();
  const denominations = data.denominations;

  let denominationsSummary = "";
  if (denominations && typeof denominations === "object") {
    denominationsSummary = formatDenominationsSummary(denominations);
    if (denominationsSummary && denominationsSummary !== "Sin desglose") {
      notesClosing = notesClosing
        ? `${notesClosing} | Arqueo Final: ${denominationsSummary}`
        : `Arqueo Final: ${denominationsSummary}`;
    }
  }

  const existingSession = await (prisma as any).cashSession.findUnique({
    where: { id: sessionId },
    include: {
      cashRegister: true,
      openedBy: { select: { id: true, username: true } },
      movements: true,
      invoices: {
        where: { status: "Issued" },
        select: { id: true, totalAmount: true },
      },
    },
  });

  if (!existingSession) {
    throw new NotFoundError("Sesión de caja no encontrada.");
  }

  if (existingSession.status === "CLOSED") {
    throw new ValidationError(
      `La sesión de caja #${sessionId} ya fue cerrada previamente el ${new Date(existingSession.closedAt).toLocaleString("es-PE")}.`
    );
  }

  const initialAmount = Number(existingSession.initialAmount) || 0;
  const salesCash = Number(existingSession.salesCash) || 0;
  const movements = existingSession.movements || [];

  const totalExpenses = movements
    .filter((m: any) => m.type === "EXPENSE")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
  const totalIncomes = movements
    .filter((m: any) => m.type === "INCOME")
    .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

  const expectedAmount = Math.round((initialAmount + salesCash + totalIncomes - totalExpenses) * 100) / 100;
  const difference = Math.round((countedAmount - expectedAmount) * 100) / 100;

  const closedAt = new Date();

  const closedSession = await (prisma as any).cashSession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED",
      closedAt,
      closedById: userId,
      finalCounted: countedAmount,
      difference,
      notesClosing: notesClosing || null,
    },
    include: {
      openedBy: { select: { id: true, username: true } },
      closedBy: { select: { id: true, username: true } },
    },
  });

  let journalEntryIds: number[] = [];
  try {
    journalEntryIds = await postCashSessionClosingJournalEntries(prisma as any, {
      sessionId: closedSession.id,
      expectedAmount,
      countedAmount,
      difference,
      entryDate: closedAt,
      responsible: closedSession.closedBy?.username || "Cajero",
      denominationsSummary: denominationsSummary || undefined,
    });
  } catch (journalErr) {
    console.warn("[cash-sessions.service] Aviso al generar asientos de cierre:", journalErr);
  }

  const formattedMovements = movements.map((m: any) => ({
    id: m.id,
    sessionId: m.sessionId,
    type: m.type,
    amount: Number(m.amount),
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  }));

  return {
    message: "Cierre y arqueo de caja registrado y enviado a contabilidad exitosamente.",
    journalEntryIds,
    session: closedSession,
    audit: {
      sessionId: closedSession.id,
      registerName: existingSession.cashRegister?.name || "Caja Principal",
      openedAt: existingSession.openedAt.toISOString(),
      closedAt: closedSession.closedAt.toISOString(),
      openedBy: existingSession.openedBy?.username || "Cajero",
      closedBy: closedSession.closedBy?.username || "Cajero",
      initialAmount,
      salesCash,
      totalExpenses,
      totalIncomes,
      expectedAmount,
      countedAmount,
      difference,
      notesClosing: closedSession.notesClosing,
      movements: formattedMovements,
    },
  };
}
