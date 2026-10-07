// d:/backs/Polleria/app/accounting/periods/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountingPeriod {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El mes y año mostrados siempre corresponden al mes actual (no editables)
  const now = new Date();
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [creating, setCreating] = useState(false);
  // No se necesita estado local para errores de creación; se muestra vía toast.

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
        subtitle="Lista de periodos abiertos y cerrados"
        icon={BookOpen}
        iconClassName="bg-red-100 text-red-700"
      />

      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-2xl space-y-6">
          <Card>
            <CardContent>
              {loading && <p>Cargando...</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {!loading && !error && (
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-slate-800/75">
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Inicio</th>
                      <th className="p-2 text-left">Fin</th>
                      <th className="p-2 text-left">Estado</th>
                      <th className="p-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.id}</td>
                        <td className="p-2">{new Date(p.startDate).toLocaleDateString()}</td>
                        <td className="p-2">{new Date(p.endDate).toLocaleDateString()}</td>
                        <td className="p-2">{p.status}</td>
                        <td className="p-2">
                          <Link className="text-primary hover:underline" href={`/accounting/journal?from=${p.startDate}&to=${p.endDate}`} data-path="libro-diario-periodo">
                            Ver Asientos
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crear Nuevo Periodo</CardTitle>
              <CardDescription>El mes y año mostrados siempre corresponden al mes actual y no pueden modificarse. Sólo se pueden crear períodos contables completos (mes completo) y no se permiten duplicados.</CardDescription>
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
