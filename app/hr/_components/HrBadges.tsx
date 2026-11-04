"use client";

import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import type { ContractPhase } from "@/lib/services/hr/contracts.service";
import type { AdvanceStatusCode, AttendanceStatus, RequestStatusCode } from "@/lib/services/hr/labor-rules";
import { ADVANCE_STATUS_LABEL } from "@/lib/services/hr/labor-rules";

const PHASE_TONE: Record<ContractPhase, StatusBadgeTone> = {
  Programado: "info",
  Vigente: "success",
  "Por vencer": "warning",
  Vencido: "danger",
  Finalizado: "neutral",
  Rescindido: "neutral",
};

export function ContractPhaseBadge({ phase }: { phase: ContractPhase }) {
  return (
    <StatusBadge tone={PHASE_TONE[phase]} pulse={phase === "Vigente"}>
      {phase}
    </StatusBadge>
  );
}

const ATTENDANCE_TONE: Record<AttendanceStatus, StatusBadgeTone> = {
  Descanso: "neutral",
  Licencia: "info",
  Programado: "neutral",
  "Sin marcar": "warning",
  "En turno": "info",
  Puntual: "success",
  Tardanza: "warning",
  Falta: "danger",
  Justificada: "info",
  "Sin salida": "warning",
  Extra: "info",
};

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return (
    <StatusBadge tone={ATTENDANCE_TONE[status]} pulse={status === "En turno"}>
      {status}
    </StatusBadge>
  );
}

const REQUEST_TONE: Record<RequestStatusCode, StatusBadgeTone> = {
  Pendiente: "warning",
  Aprobada: "success",
  Rechazada: "danger",
  Anulada: "neutral",
};

export function RequestBadge({ status }: { status: RequestStatusCode }) {
  return <StatusBadge tone={REQUEST_TONE[status]}>{status}</StatusBadge>;
}

const ADVANCE_TONE: Record<AdvanceStatusCode, StatusBadgeTone> = {
  Pendiente: "warning",
  Aprobado: "info",
  Rechazado: "danger",
  Pagado: "info",
  Liquidado: "success",
  Anulado: "neutral",
};

export function AdvanceBadge({ status }: { status: AdvanceStatusCode }) {
  return <StatusBadge tone={ADVANCE_TONE[status]}>{ADVANCE_STATUS_LABEL[status]}</StatusBadge>;
}
