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
  QrCode,
  Smartphone,
  Upload,
  ImageIcon,
  Trash2,
  Crop,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RestaurantInfo } from "@/lib/services/restaurant-config.service";

export default function RestaurantBusinessSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cropperModalOpen, setCropperModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
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
    yapePhone: "",
    yapeName: "",
    yapeQrImageUrl: "",
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

      const resJson = await res.json().catch(() => null);
      if (resJson?.data) {
        setForm((prev) => ({ ...prev, ...resJson.data }));
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
              <QrCode className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-sm text-foreground">Billeteras Digitales (Yape / Plin)</h3>
                <p className="text-[11px] text-muted-foreground">
                  Configura el número y titular para recibir pagos con Yape en mesas y caja.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Número de Celular Yape / Plin
                </label>
                <div className="relative">
                  <Input
                    placeholder="Ej: 987654321"
                    maxLength={9}
                    value={form.yapePhone || ""}
                    onChange={(e) => handleChange("yapePhone", e.target.value.replace(/\D/g, ""))}
                    className="text-xs h-9 rounded-xl font-mono font-bold pl-8"
                  />
                  <Smartphone className="w-3.5 h-3.5 text-purple-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Número de 9 dígitos afiliado a Yape. Obligatorio para que la app Yape reconozca la cuenta al escanear o pagar.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Nombre del Titular en Yape
                </label>
                <Input
                  placeholder="Ej: El Buen Sabor a la Brasa"
                  value={form.yapeName || ""}
                  onChange={(e) => handleChange("yapeName", e.target.value)}
                  className="text-xs h-9 rounded-xl font-medium"
                />
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Nombre visible que confirmará el cliente antes de pulsar &quot;YAPEAR&quot;.
                </span>
              </div>
            </div>

            {/* Imagen del QR Oficial de Yape */}
            <div className="pt-2 border-t border-border flex flex-col gap-2">
              <label className="text-xs font-bold text-foreground block">
                Código QR Oficial de Yape (Recomendado para escaneo sin errores)
              </label>
              <p className="text-[11px] text-muted-foreground">
                Sube la imagen de tu código QR oficial (el que descargas desde tu app Yape en <strong>Cobrar con QR</strong> o la foto de tu sticker oficial). Al mostrar tu QR oficial, cualquier cliente podrá escanearlo desde la app de Yape en su celular de forma inmediata y 100% compatible.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir imagen de mi QR Yape</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("La imagen no debe superar los 5MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        if (base64) {
                          setImageToCrop(base64);
                          setCropperModalOpen(true);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {form.yapeQrImageUrl && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageToCrop(form.yapeQrImageUrl || "");
                        setCropperModalOpen(true);
                      }}
                      className="text-xs text-purple-800 border-purple-300 hover:bg-purple-100/70 h-8 font-semibold rounded-xl"
                    >
                      <Crop className="w-3.5 h-3.5 mr-1" />
                      Recortar / Ajustar QR
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleChange("yapeQrImageUrl", "");
                        toast.info("Imagen de QR Yape eliminada.");
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Quitar imagen
                    </Button>
                  </>
                )}
              </div>

              {form.yapeQrImageUrl && (
                <div className="mt-2 p-3 bg-purple-50/50 border border-purple-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.yapeQrImageUrl}
                      alt="Vista previa QR Oficial Yape"
                      className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg border border-purple-200 bg-white p-1 shadow-2xs shrink-0"
                    />
                    <div className="text-xs text-purple-950 flex flex-col gap-0.5">
                      <span className="font-bold flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        QR Oficial Listo y Encuadrado
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Este código QR se mostrará optimizado en las pantallas de cobro de los mozos y en caja para que los clientes lo escaneen directamente con su app Yape.
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImageToCrop(form.yapeQrImageUrl || "");
                      setCropperModalOpen(true);
                    }}
                    className="text-xs font-bold text-purple-800 border-purple-300 hover:bg-purple-100/70 h-8 rounded-xl cursor-pointer shrink-0 self-end sm:self-auto"
                  >
                    <Crop className="w-3.5 h-3.5 mr-1" />
                    Reajustar Recorte
                  </Button>
                </div>
              )}
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

      <ImageCropperModal
        isOpen={cropperModalOpen}
        onClose={() => setCropperModalOpen(false)}
        imageSrc={imageToCrop}
        onCropComplete={(croppedBase64) => {
          handleChange("yapeQrImageUrl", croppedBase64);
          toast.success("¡QR recortado con éxito! Recuerda pulsar 'Guardar Configuración' para aplicar los cambios.");
        }}
        title="Recortar y Encuadrar QR de Yape"
        description="Enfoca solo el código QR cuadrado. Elimina bordes o capturas de pantalla para un escaneo perfecto."
      />
    </>
  );
}
