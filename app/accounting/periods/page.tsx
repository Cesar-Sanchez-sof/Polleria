// d:/backs/Polleria/app/accounting/periods/page.tsx
"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BookOpen, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  availableFiscalYears,
  currentFiscalYear,
  filterByFiscalYear,
  formatDate,
  groupByFiscalYear,
  statusLabel,
  type AccountingPeriod,
} from "./fiscal-years";

/** Valor del selector que desactiva el filtro de año fiscal. */
const ALL_YEARS = "todos";

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El mes y año mostrados siempre corresponden al mes actual (no editables)
  const now = new Date();
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [creating, setCreating] = useState(false);
  // Año fiscal por defecto: todos los registrados (la lista se agrupa igual por año).
  const [fiscalYear, setFiscalYear] = useState<string>(ALL_YEARS);
  // No se necesita estado local para errores de creación; se muestra vía toast.

  const fiscalYears = useMemo(() => availableFiscalYears(periods), [periods]);
  const groups = useMemo(
    () =>
      groupByFiscalYear(
        filterByFiscalYear(periods, fiscalYear === ALL_YEARS ? null : Number(fiscalYear))
      ),
    [periods, fiscalYear]
  );

  const tableRows = useMemo(() => groups.flatMap((group) => group.periods), [groups]);
  const yearOfPeriod = useMemo(() => {
    const map = new Map<number, number>();
    for (const group of groups) for (const period of group.periods) map.set(period.id, group.year);
    return map;
  }, [groups]);

  const columns: DataTableColumn<AccountingPeriod>[] = [
    { key: "id", header: "ID", width: "w-20", cell: (p) => p.id },
    { key: "start", header: "Inicio", cell: (p) => formatDate(p.startDate) },
    { key: "end", header: "Fin", cell: (p) => formatDate(p.endDate) },
    {
      key: "status",
      header: "Estado",
      cell: (p) => (
        <StatusBadge tone={p.status === "OPEN" ? "success" : "neutral"} size="sm">
          {statusLabel(p.status)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      cell: (p) => (
        <RowActions
          mode="label"
          align="start"
          actions={[
            { key: "entries", label: "Ver Asientos", tone: "blue", href: `/accounting/journal?from=${p.startDate}&to=${p.endDate}` },
          ]}
        />
      ),
    },
  ];

  const fetchPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting-periods", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch periods");
      const data: AccountingPeriod[] = await res.json();
      setPeriods(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    // No se usa estado de error local
    setCreating(true);
    try {
      const res = await fetch("/api/accounting-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: Number(month), year: Number(year) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.errors?.join?.(", ") || data.error || "Failed to create period");
      }
      // No hay campos editables que resetear
      // Refresh list
      await fetchPeriods();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <ModuleHeader
        title="Periodos Contables"
        subtitle="Períodos mensuales agrupados por año fiscal (enero – diciembre)"
        icon={BookOpen}
        iconClassName="bg-red-100 text-red-700"
      />

      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-3xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Períodos por año fiscal
                </CardTitle>
                <CardDescription>
                  Cada año fiscal agrupa sus períodos mensuales con sus fechas y estado.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="anio-fiscal" className="text-xs text-muted-foreground">
                  Año fiscal
                </Label>
                <NativeSelect
                  id="anio-fiscal"
                  className="w-56"
                  aria-label="Filtrar por año fiscal"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                >
                  <option value={ALL_YEARS}>Todos los años fiscales</option>
                  {fiscalYears.map((y) => (
                    <option key={y} value={String(y)}>
                      Año fiscal {y}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <DataTable
                columns={columns}
                rows={tableRows}
                rowKey={(p) => p.id}
                enableCard={false}
                density="compact"
                loading={loading}
                loadingMode="auto"
                error={error}
                onRetry={() => void fetchPeriods()}
                groupBy={(p) => yearOfPeriod.get(p.id) ?? 0}
                renderGroupHeader={(key) => {
                  const group = groups.find((g) => g.year === key);
                  if (!group) return null;
                  return (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">Año fiscal {group.year}</span>
                      <Badge variant="secondary">
                        {group.periods.length} {group.periods.length === 1 ? "período" : "períodos"}
                      </Badge>
                      <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                        {group.open} abiertos · {group.closed} cerrados
                      </span>
                    </span>
                  );
                }}
                emptyState={{
                  icon: <CalendarDays className="h-7 w-7" />,
                  title:
                    periods.length === 0
                      ? "Aún no hay períodos contables. Crea el período del mes actual más abajo."
                      : `El año fiscal ${fiscalYear} aún no tiene períodos registrados.`,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crear Nuevo Periodo</CardTitle>
              <CardDescription>
                El mes y año mostrados siempre corresponden al mes actual y no pueden modificarse.
                Sólo se pueden crear períodos contables completos (mes completo) y no se permiten
                duplicados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Mes</Label>
                  <Input value={month} disabled className="border rounded p-2 bg-gray-100" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Año</Label>
                  <Input value={year} disabled className="border rounded p-2 bg-gray-100" />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  El período se creará dentro del{" "}
                  <strong className="text-foreground">año fiscal {currentFiscalYear()}</strong>{" "}
                  (enero – diciembre).
                </p>
                {/* No se muestra error local, se muestra vía toast */}
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear Periodo"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
