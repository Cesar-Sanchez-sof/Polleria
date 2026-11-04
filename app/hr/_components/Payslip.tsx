"use client";

import { Printer } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PayrollLineDto } from "@/lib/services/hr/payroll.service";
import { fmtDate, fmtMinutes, money } from "../_lib/hr-client";

const PENSION_LABEL: Record<string, string> = {
  onp: "ONP (13 %)",
  afp_contribution: "AFP aporte obligatorio (10 %)",
  afp_insurance: "AFP prima de seguro (1.37 %)",
  afp_commission: "AFP comisión sobre flujo",
};

function Row({ k, v, strong, negative }: { k: string; v: number; strong?: boolean; negative?: boolean }) {
  if (!v && !strong) return null;
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${strong ? "border-t pt-1.5 font-bold" : ""}`}>
      <span>{k}</span>
      <span className="font-mono">{negative && v ? `- ${money.format(v)}` : money.format(v)}</span>
    </div>
  );
}

/** Boleta de pago (vista e impresión). */
export function PayslipDialog({ line, periodLabel, onClose }: { line: PayrollLineDto | null; periodLabel: string; onClose: () => void }) {
  if (!line) return null;
  const l = line;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl print:max-h-none print:shadow-none">
        <DialogHeader>
          <DialogTitle>Boleta de pago · {periodLabel}</DialogTitle>
          <DialogDescription>
            {l.employee_name} · DNI {l.employee_dni} · {l.position ?? "—"} · {l.contract_type_label ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div id="payslip" className="grid gap-4 text-sm sm:grid-cols-2">
          <section className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Jornada del mes</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>Días del contrato</span>
              <span className="text-right font-mono">{l.contract_days}</span>
              <span>Días no remunerados</span>
              <span className="text-right font-mono">{l.unpaid_days}</span>
              <span>Días pagados</span>
              <span className="text-right font-mono font-semibold">{l.paid_days}</span>
              <span>Tardanzas</span>
              <span className="text-right font-mono">{fmtMinutes(l.late_minutes)}</span>
              <span>Horas extra</span>
              <span className="text-right font-mono">{fmtMinutes(l.overtime_minutes)}</span>
              <span>Sueldo básico pactado</span>
              <span className="text-right font-mono">{money.format(l.base_salary)}</span>
            </div>
          </section>
          <section className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ingresos</p>
            <div className="text-xs">
              <Row k={`Básico (${l.paid_days} días)`} v={l.basic_pay} />
              <Row k="Asignación familiar" v={l.family_allowance} />
              <Row k="Horas extra (25 % / 35 %)" v={l.overtime_pay} />
              <Row k="Bonos y otros ingresos" v={l.bonus} />
              <Row k="Descuento por tardanzas" v={l.late_discount} negative />
              <Row k="Remuneración bruta" v={l.gross_pay} strong />
            </div>
          </section>
          <section className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Descuentos al trabajador</p>
            <div className="text-xs">
              {Object.entries(l.detail.pension).map(([k, v]) => (
                <Row key={k} k={PENSION_LABEL[k] ?? k} v={v} />
              ))}
              <Row k="Renta de 5.ª categoría" v={l.income_tax} />
              {l.detail.advances.map((a) => (
                <Row key={a.advance_id} k={`Adelanto de sueldo #${a.advance_id}`} v={a.amount} />
              ))}
              <Row k="Otros descuentos" v={l.other_deductions} />
              <Row k="Total descuentos" v={l.deductions} strong />
            </div>
          </section>
          <section className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Aportes del empleador</p>
            <div className="text-xs">
              <Row k="EsSalud (9 %)" v={l.essalud} />
              <Row k="Seguros (Vida Ley, SCTR, EPS…)" v={l.insurance_cost} />
              <Row k="Costo total para la empresa" v={l.employer_cost} strong />
            </div>
          </section>
          <section className="flex items-center justify-between rounded-xl bg-primary/10 p-4 sm:col-span-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Neto a pagar</p>
              <p className="text-xs text-muted-foreground">
                {l.pension_system ?? ""} {l.payment_date ? `· pagado el ${fmtDate(l.payment_date)}` : "· pendiente de pago"}
              </p>
            </div>
            <p className="font-mono text-2xl font-bold text-primary">{money.format(l.net_pay)}</p>
          </section>
          {(l.detail.warnings.length > 0 || l.notes) && (
            <section className="text-xs text-muted-foreground sm:col-span-2">
              {l.notes && <p>Observación: {l.notes}</p>}
              {l.detail.warnings.map((w) => (
                <p key={w}>• {w}</p>
              ))}
            </section>
          )}
        </div>
        <div className="flex justify-end print:hidden">
          <AppButton size="sm" variant="secondary" icon={<Printer />} onClick={() => window.print()}>
            Imprimir boleta
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
