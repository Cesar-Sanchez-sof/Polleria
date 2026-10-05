// d:/backs/Polleria/app/accounting/periods/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/accounting-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.errors?.join?.(", ") || data.error || "Failed to create period");
      }
      // Reset form
      setStartDate("");
      setEndDate("");
      // Refresh list
      await fetchPeriods();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
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
                    <tr className="bg-gray-100">
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
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="endDate">Fecha de Fin</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear Periodo"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
