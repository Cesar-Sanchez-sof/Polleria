"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Save,
  RefreshCw,
  Receipt,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RestaurantInfo } from "@/lib/services/restaurant-config.service";

export default function RestaurantBusinessSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RestaurantInfo>({
    name: "",
    commercialName: "",
    ruc: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    ticketFooter: "",
    currency: "S/ PEN",
    logoUrl: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/restaurant");
      if (!res.ok) throw new Error("No se pudo cargar la información del restaurante.");
      const json = await res.json();
      if (json.data) {
        setForm(json.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleChange = (field: keyof RestaurantInfo, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("La Razón Social es requerida.");
      return;
    }

    const rucClean = form.ruc.trim();
    if (!/^\d{11}$/.test(rucClean)) {
      toast.error("El RUC debe tener exactamente 11 dígitos numéricos.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/restaurant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar configuración.");
      }

      toast.success("¡Datos del restaurante actualizados correctamente!");
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar los datos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ModuleHeader
        title="Datos del Restaurante / Empresa"
        subtitle="Configuración de identidad fiscal, dirección, contacto y pie de boletas"
        icon={Building2}
        iconClassName="bg-amber-100 text-amber-800"
      >
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
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Formulario Principal */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Identidad Fiscal y Comercial</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Razón Social (Oficial SUNAT) *
                </label>
                <Input
                  required
                  placeholder="Ej: POLLERÍA & BRASAS EL BUEN SABOR S.A.C."
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="text-xs h-9 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    RUC (11 dígitos) *
                  </label>
                  <div className="relative">
                    <Input
                      required
                      maxLength={11}
                      placeholder="Ej: 20608976543"
                      value={form.ruc}
                      onChange={(e) => handleChange("ruc", e.target.value.replace(/\D/g, ""))}
                      className="text-xs h-9 rounded-xl font-mono font-bold pl-8"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Nombre Comercial (Marca)
                  </label>
                  <Input
                    placeholder="Ej: El Buen Sabor a la Brasa"
                    value={form.commercialName}
                    onChange={(e) => handleChange("commercialName", e.target.value)}
                    className="text-xs h-9 rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Ubicación y Contacto</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Dirección Fiscal del Local
                </label>
                <Input
                  placeholder="Ej: Av. Los Héroes 456, San Juan de Miraflores"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="text-xs h-9 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Ciudad / Distrito
                  </label>
                  <Input
                    placeholder="Ej: Lima, Perú"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    className="text-xs h-9 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Ej: +51 987 654 321"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="text-xs h-9 rounded-xl font-medium pl-8"
                    />
                    <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Correo Electrónico de Consultas
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Ej: contacto@elbuensabor.pe"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="text-xs h-9 rounded-xl font-medium pl-8"
                  />
                  <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Receipt className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Mensaje en Comprobante Térmico</h3>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Pie de Ticket (Mensaje de despedida y agradecimiento)
              </label>
              <textarea
                rows={3}
                placeholder="¡Gracias por su visita! Pollería & Brasas les desea un excelente día..."
                value={form.ticketFooter}
                onChange={(e) => handleChange("ticketFooter", e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-input bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[10px] text-muted-foreground block mt-1">
                Este mensaje se imprimirá automáticamente al pie de las boletas, facturas y tickets entregados a clientes.
              </span>
            </div>
          </Card>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Guardando cambios..." : "Guardar Configuración del Restaurante"}</span>
          </Button>
        </form>

        {/* Vista Previa del Ticket Impreso */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-1.5 px-1">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Vista Previa en Ticket Térmico (80mm)
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 p-5 rounded-2xl shadow-xs font-mono text-[11px] text-slate-800 dark:text-slate-200 space-y-3">
            {/* Cabecera del ticket */}
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
              <span className="font-extrabold text-xs block text-slate-900 dark:text-white uppercase tracking-wider">
                {form.commercialName || "NOMBRE COMERCIAL"}
              </span>
              <span className="font-bold text-[10px] block text-slate-600 dark:text-slate-400">
                {form.name || "RAZÓN SOCIAL DE LA EMPRESA"}
              </span>
              <span className="block text-[10px] font-bold">RUC: {form.ruc || "20000000000"}</span>
              <span className="block text-[10px] text-slate-500">{form.address || "Dirección Fiscal"}</span>
              <span className="block text-[10px] text-slate-500">{form.city || "Lima, Perú"}</span>
              {form.phone && <span className="block text-[10px] text-slate-500">Telf: {form.phone}</span>}
            </div>

            {/* Muestra referencial de ítems */}
            <div className="space-y-1.5 py-1 text-[10px] border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="flex justify-between font-bold">
                <span>BOLETA ELECTRÓNICA</span>
                <span>B001-000124</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Mesa: 2 (Salón)</span>
                <span>13/10/2026 13:45</span>
              </div>
              <div className="pt-1 space-y-1">
                <div className="flex justify-between">
                  <span>1x 1 Pollo a la Brasa</span>
                  <span>S/ 72.50</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Jarra Chicha Morada</span>
                  <span>S/ 16.00</span>
                </div>
              </div>
            </div>

            {/* Totales */}
            <div className="space-y-1 text-[10px] pt-1 pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="flex justify-between">
                <span>OP. GRAVADA:</span>
                <span>S/ 75.00</span>
              </div>
              <div className="flex justify-between">
                <span>I.G.V. (18%):</span>
                <span>S/ 13.50</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>TOTAL A PAGAR:</span>
                <span className="text-emerald-600 dark:text-emerald-400">S/ 88.50</span>
              </div>
            </div>

            {/* Pie de ticket configurado */}
            <div className="text-center pt-2 text-[10px] text-slate-500 leading-relaxed italic">
              {form.ticketFooter || "¡Gracias por su preferencia!"}
            </div>
          </div>
        </div>
      </div>
      </main>
    </>
  );
}
