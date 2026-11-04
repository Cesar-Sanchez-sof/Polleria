"use client";

import Link from "next/link";
import { AlertTriangle, BellRing, Info, ShieldAlert } from "lucide-react";
import type { HrAlert } from "@/lib/services/hr/contracts.service";

const ICON = { danger: ShieldAlert, warning: AlertTriangle, info: Info };
const TONE = {
  danger: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200",
};

/** Pendientes de cumplimiento laboral (contratos por vencer, sin Vida Ley, sin horario…). */
export function AlertsPanel({ alerts, max = 6 }: { alerts: HrAlert[]; max?: number }) {
  if (alerts.length === 0) return null;
  return (
    <section className="rounded-2xl border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold">
        <BellRing className="h-4 w-4 text-primary" /> Pendientes de cumplimiento ({alerts.length})
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {alerts.slice(0, max).map((a, i) => {
          const Icon = ICON[a.severity];
          return (
            <li key={`${a.kind}-${a.employee_id}-${i}`}>
              <Link
                href={`/hr/employees/${a.employee_id}`}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs transition-opacity hover:opacity-80 ${TONE[a.severity]}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <b>{a.employee_name}</b> — {a.message}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {alerts.length > max && <p className="mt-2 text-xs text-muted-foreground">y {alerts.length - max} pendiente(s) más en Contratos.</p>}
    </section>
  );
}
