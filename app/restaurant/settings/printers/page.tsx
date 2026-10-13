"use client";

import { useEffect, useState } from "react";
import {
  Printer,
  Receipt,
  Save,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Usb,
  Flame,
  Wine,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrinterConfig } from "@/lib/services/restaurant-config.service";

export default function RestaurantPrintersSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const [config, setConfig] = useState<PrinterConfig>({
    paperWidth: "80mm",
    autoCut: true,
    autoPrintVoucher: true,
    printWaiterCopy: false,
    series: {
      boleta: "B001",
      factura: "F001",
      ticket: "T001",
    },
    kitchenPrinter: {
      name: "Comandera Cocina (Epson TM-T20III)",
      ipOrPort: "192.168.1.200:9100",
      active: true,
      autoPrintOnOrder: true,
    },
    barPrinter: {
      name: "Comandera Bar / Bebidas",
      ipOrPort: "192.168.1.201:9100",
      active: false,
      autoPrintOnOrder: false,
    },
    cashierPrinter: {
      name: "Impresora Térmica Caja 80mm",
      ipOrPort: "USB001 / Local",
      active: true,
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/printers");
      if (!res.ok) throw new Error("No se pudo cargar la configuración de impresión.");
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar configuración de impresoras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/printers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Error al guardar la configuración de impresoras.");
      toast.success("¡Configuración de comprobantes e impresoras actualizada!");
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintTest = () => {
    setTestModalOpen(true);
  };

  return (
    <>
      <ModuleHeader
        title="Comprobantes, Series e Impresoras Térmicas"
        subtitle="Gestión de series de facturación, comanderas de cocina/bar y parámetros de tickets"
        icon={Printer}
        iconClassName="bg-blue-100 text-blue-800"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 px-3 rounded-xl border-border text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
          <Button
            size="sm"
            onClick={handlePrintTest}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Ticket de Prueba</span>
          </Button>
        </div>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <form onSubmit={handleSave} className="space-y-4">
        {/* 1. Series de Facturación */}
        <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Series Oficiales de Facturación</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Serie de Boleta Electrónica
              </label>
              <Input
                required
                maxLength={4}
                placeholder="B001"
                value={config.series.boleta}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    series: { ...prev.series, boleta: e.target.value.toUpperCase() },
                  }))
                }
                className="text-xs h-9 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-muted-foreground block mt-1">Estándar SUNAT: B001 - B999</span>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Serie de Factura Electrónica
              </label>
              <Input
                required
                maxLength={4}
                placeholder="F001"
                value={config.series.factura}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    series: { ...prev.series, factura: e.target.value.toUpperCase() },
                  }))
                }
                className="text-xs h-9 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-muted-foreground block mt-1">Estándar SUNAT: F001 - F999</span>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Serie de Ticket / Pre-cuenta
              </label>
              <Input
                required
                maxLength={4}
                placeholder="T001"
                value={config.series.ticket}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    series: { ...prev.series, ticket: e.target.value.toUpperCase() },
                  }))
                }
                className="text-xs h-9 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-muted-foreground block mt-1">Control interno del salón</span>
            </div>
          </div>
        </Card>

        {/* 2. Parámetros de Papel y Comportamiento */}
        <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Sliders className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Formato de Ticket y Opciones de Impresión</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ancho de papel */}
            <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 space-y-1.5">
              <span className="text-xs font-bold text-foreground block">Ancho de Papel Térmico</span>
              <div className="flex gap-1.5 pt-1">
                {(["80mm", "58mm"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, paperWidth: w }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      config.paperWidth === w
                        ? "bg-primary text-white shadow-xs"
                        : "bg-background border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-corte de papel */}
            <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
              <span className="text-xs font-bold text-foreground block">Corte Automático (Auto-cut)</span>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, autoCut: !prev.autoCut }))}
                className={`w-full py-1.5 mt-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.autoCut
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-background border border-border text-muted-foreground"
                }`}
              >
                {config.autoCut ? "Habilitado ✓" : "Deshabilitado"}
              </button>
            </div>

            {/* Impresión automática al cobrar */}
            <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
              <span className="text-xs font-bold text-foreground block">Auto-imprimir al Cobrar</span>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, autoPrintVoucher: !prev.autoPrintVoucher }))
                }
                className={`w-full py-1.5 mt-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.autoPrintVoucher
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-background border border-border text-muted-foreground"
                }`}
              >
                {config.autoPrintVoucher ? "Automático ✓" : "Manual"}
              </button>
            </div>

            {/* Copia para el Mozo */}
            <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
              <span className="text-xs font-bold text-foreground block">Imprimir Copia Mozo</span>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, printWaiterCopy: !prev.printWaiterCopy }))
                }
                className={`w-full py-1.5 mt-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.printWaiterCopy
                    ? "bg-primary text-white shadow-xs"
                    : "bg-background border border-border text-muted-foreground"
                }`}
              >
                {config.printWaiterCopy ? "Doble Copia ✓" : "Copia Única"}
              </button>
            </div>
          </div>
        </Card>

        {/* 3. Dispositivos e Impresoras Térmicas */}
        <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Printer className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Comanderas de Red e Impresoras de Caja</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Comandera Cocina */}
            <div className="p-4 rounded-2xl border border-border bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Comandera Cocina</span>
                    <span className="text-[10px] text-muted-foreground">Platos calientes y brasas</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      kitchenPrinter: {
                        ...prev.kitchenPrinter,
                        active: !prev.kitchenPrinter.active,
                      },
                    }))
                  }
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    config.kitchenPrinter.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {config.kitchenPrinter.active ? "✓" : "×"}
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Nombre Dispositivo</label>
                  <Input
                    value={config.kitchenPrinter.name}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        kitchenPrinter: { ...prev.kitchenPrinter, name: e.target.value },
                      }))
                    }
                    className="text-xs h-8 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">IP de Red / Puerto</label>
                  <div className="relative">
                    <Input
                      value={config.kitchenPrinter.ipOrPort}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          kitchenPrinter: { ...prev.kitchenPrinter, ipOrPort: e.target.value },
                        }))
                      }
                      className="text-xs h-8 rounded-lg pl-7 font-mono"
                    />
                    <Wifi className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Comandera Bar */}
            <div className="p-4 rounded-2xl border border-border bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Wine className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Comandera Bar</span>
                    <span className="text-[10px] text-muted-foreground">Bebidas y coctelería</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      barPrinter: {
                        ...prev.barPrinter,
                        active: !prev.barPrinter.active,
                      },
                    }))
                  }
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    config.barPrinter.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {config.barPrinter.active ? "✓" : "×"}
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Nombre Dispositivo</label>
                  <Input
                    value={config.barPrinter.name}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        barPrinter: { ...prev.barPrinter, name: e.target.value },
                      }))
                    }
                    className="text-xs h-8 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">IP de Red / Puerto</label>
                  <div className="relative">
                    <Input
                      value={config.barPrinter.ipOrPort}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          barPrinter: { ...prev.barPrinter, ipOrPort: e.target.value },
                        }))
                      }
                      className="text-xs h-8 rounded-lg pl-7 font-mono"
                    />
                    <Wifi className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Impresora Caja */}
            <div className="p-4 rounded-2xl border border-border bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Impresora de Caja</span>
                    <span className="text-[10px] text-muted-foreground">Comprobantes y boletas</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      cashierPrinter: {
                        ...prev.cashierPrinter,
                        active: !prev.cashierPrinter.active,
                      },
                    }))
                  }
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    config.cashierPrinter.active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {config.cashierPrinter.active ? "✓" : "×"}
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Nombre Dispositivo</label>
                  <Input
                    value={config.cashierPrinter.name}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        cashierPrinter: { ...prev.cashierPrinter, name: e.target.value },
                      }))
                    }
                    className="text-xs h-8 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Conexión USB / Puerto</label>
                  <div className="relative">
                    <Input
                      value={config.cashierPrinter.ipOrPort}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cashierPrinter: { ...prev.cashierPrinter, ipOrPort: e.target.value },
                        }))
                      }
                      className="text-xs h-8 rounded-lg pl-7 font-mono"
                    />
                    <Usb className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Guardando configuración..." : "Guardar Configuración de Impresión"}</span>
        </Button>
      </form>

      {/* Modal Ticket de Prueba */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              <span>Ticket de Prueba ({config.paperWidth})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Comprueba el formato térmico y alineación antes de enviar a comanderas.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`my-3 p-4 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[10px] text-slate-800 dark:text-slate-200 space-y-2 ${
              config.paperWidth === "58mm" ? "max-w-[220px] mx-auto text-[9px]" : ""
            }`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-1">
              <span className="font-bold block text-xs">EL BUEN SABOR A LA BRASA</span>
              <span>TEST DE IMPRESIÓN</span>
              <span className="block">{new Date().toLocaleString("es-PE")}</span>
            </div>

            <div className="py-1 space-y-1">
              <div className="flex justify-between">
                <span>SERIE BOLETA:</span>
                <span className="font-bold">{config.series.boleta}</span>
              </div>
              <div className="flex justify-between">
                <span>SERIE FACTURA:</span>
                <span className="font-bold">{config.series.factura}</span>
              </div>
              <div className="flex justify-between">
                <span>SERIE TICKET:</span>
                <span className="font-bold">{config.series.ticket}</span>
              </div>
              <div className="flex justify-between">
                <span>ANCHO PAPEL:</span>
                <span className="font-bold">{config.paperWidth}</span>
              </div>
              <div className="flex justify-between">
                <span>CORTE AUTO:</span>
                <span className="font-bold">{config.autoCut ? "SÍ" : "NO"}</span>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-dashed border-slate-300 italic text-[9px]">
              *** PRUEBA SATISFACTORIA ***
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                window.print();
                setTestModalOpen(false);
              }}
              className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Imprimir en Dispositivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </>
  );
}
