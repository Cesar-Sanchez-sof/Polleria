"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { SupplierDialog } from "@/components/purchases/suppliers/SupplierDialog";
import { SupplyDialog } from "@/components/purchases/inventory/SupplyDialog";
import { SupplySearchSelect, SupplyItem } from "./SupplySearchSelect";
import { SupplierSearchSelect } from "./SupplierSearchSelect";
import { registerUnifiedPurchase } from "@/lib/services/purchases/purchase-order";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  Package,
  Plus,
  Trash2,
  Save,
  UserPlus,
  PackagePlus,
  ShoppingCart,
  MapPin,
  User,
  Phone,
  Mail,
  CreditCard,
  Receipt,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  Banknote,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AffectationIgv } from "@prisma/client";

interface Supplier {
  id: number;
  ruc: string;
  businessName: string;
  contactPerson?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
}

interface PaymentType {
  id: number;
  name: string;
  active?: boolean;
}

interface PurchaseOrderFormProps {
  initialSuppliers: Supplier[];
  initialSupplies: SupplyItem[];
  paymentTypes: PaymentType[];
}

interface LineForm {
  supplyId: number | "";
  quantity: number | "";
  unitPrice: number | "";
  affectationIgv: AffectationIgv;
}

export function PurchaseOrderForm({
  initialSuppliers,
  initialSupplies,
  paymentTypes,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplies, setSupplies] = useState<SupplyItem[]>(initialSupplies);

  // Bloque A: Proveedor
  const [supplierId, setSupplierId] = useState<number | "">("");

  // Bloque B: Comprobante y Pago
  const [voucherType, setVoucherType] = useState<string>("Factura");
  const [series, setSeries] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [issuedAt, setIssuedAt] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentCondition, setPaymentCondition] = useState<"Contado" | "Credito">(
    "Contado"
  );

  // Excluir "Tarjeta / POS" según reglas del módulo
  const allowedPaymentTypes = useMemo(() => {
    return paymentTypes.filter(
      (pt) => pt.active !== false && !/tarjeta|pos/i.test(pt.name)
    );
  }, [paymentTypes]);

  const [paymentTypeId, setPaymentTypeId] = useState<number | "">(
    allowedPaymentTypes.length > 0 ? allowedPaymentTypes[0].id : ""
  );

  // Bloque C: Insumos
  const [lines, setLines] = useState<LineForm[]>([
    { supplyId: "", quantity: 1, unitPrice: 0, affectationIgv: AffectationIgv.Excluded },
  ]);

  const [loading, setLoading] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [prefilledSupplierQuery, setPrefilledSupplierQuery] = useState("");
  const [prefilledSupplyName, setPrefilledSupplyName] = useState("");
  const [targetLineIndex, setTargetLineIndex] = useState<number | null>(null);

  // Filtrar activos
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.active !== false),
    [suppliers]
  );

  const activeSupplies = useMemo(
    () => supplies.filter((s) => s.active !== false),
    [supplies]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === Number(supplierId)) || null,
    [suppliers, supplierId]
  );

  const selectedPaymentType = useMemo(
    () => allowedPaymentTypes.find((pt) => pt.id === Number(paymentTypeId)) || null,
    [allowedPaymentTypes, paymentTypeId]
  );

  // Supplier Creation Handler
  const handleSupplierCreated = (created: any) => {
    if (created) {
      setSuppliers((prev) => [created, ...prev]);
      setSupplierId(created.id);
    }
  };

  // Supply Creation Handler
  const handleSupplyCreated = (created: any) => {
    if (created) {
      setSupplies((prev) => [created, ...prev]);
      if (targetLineIndex !== null) {
        handleSupplySelectForLine(targetLineIndex, created);
      }
    }
  };

  const handleOpenSupplyDialog = (index: number, suggestedName: string = "") => {
    setTargetLineIndex(index);
    setPrefilledSupplyName(suggestedName);
    setSupplyDialogOpen(true);
  };

  // Line Handlers
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { supplyId: "", quantity: 1, unitPrice: 0, affectationIgv: AffectationIgv.Excluded },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 0) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplySelectForLine = (index: number, supply: SupplyItem) => {
    setLines((prev) => {
      const copy = [...prev];
      const affectation = supply.affectationIgv || AffectationIgv.Excluded;
      const suggestedPrice = supply.lastCost ? Number(supply.lastCost) : 0;

      copy[index] = {
        ...copy[index],
        supplyId: supply.id,
        affectationIgv: affectation,
        unitPrice: suggestedPrice > 0 ? suggestedPrice : copy[index].unitPrice || 0,
      };
      return copy;
    });
  };

  const handleLineValueChange = (
    index: number,
    field: "quantity" | "unitPrice" | "affectationIgv",
    val: any
  ) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Line & Total Calculations
  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;

      let subtotalLine = 0;
      let igvLine = 0;
      let finalAmountLine = 0;

      if (line.affectationIgv === AffectationIgv.Included) {
        subtotalLine = (qty * price) / 1.18;
        igvLine = qty * price - subtotalLine;
        finalAmountLine = qty * price;
      } else {
        subtotalLine = qty * price;
        igvLine = subtotalLine * 0.18;
        finalAmountLine = subtotalLine + igvLine;
      }

      return {
        ...line,
        subtotalLine,
        igvLine,
        finalAmountLine,
      };
    });
  }, [lines]);

  const totals = useMemo(() => {
    let subtotalGeneral = 0;
    let igvGeneral = 0;
    let totalGeneral = 0;

    calculatedLines.forEach((l) => {
      subtotalGeneral += l.subtotalLine;
      igvGeneral += l.igvLine;
      totalGeneral += l.finalAmountLine;
    });

    return {
      subtotalGeneral,
      igvGeneral,
      totalGeneral,
    };
  }, [calculatedLines]);

  // Form Validation
  const isValid = useMemo(() => {
    if (!supplierId) return false;
    if (!voucherType || !series.trim() || !number.trim()) return false;
    if (!paymentTypeId) return false;
    const validLines = lines.filter(
      (l) => l.supplyId !== "" && Number(l.quantity) > 0
    );
    if (validLines.length === 0) return false;
    return true;
  }, [supplierId, voucherType, series, number, paymentTypeId, lines]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const validItems = lines
      .filter((l) => l.supplyId !== "" && Number(l.quantity) > 0)
      .map((l) => ({
        supplyId: Number(l.supplyId),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
        affectationIgv: l.affectationIgv === AffectationIgv.Included ? ("Included" as const) : ("Excluded" as const),
      }));

    const numVal = parseInt(number, 10);
    if (isNaN(numVal) || numVal <= 0 || numVal > 99999999) {
      toast.error("El número de comprobante debe tener un máximo de 8 dígitos");
      return;
    }

    setLoading(true);
    try {
      await registerUnifiedPurchase({
        supplierId: Number(supplierId),
        voucherType,
        series: series.trim().toUpperCase(),
        number: numVal,
        issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
        paymentCondition,
        paymentTypeId: Number(paymentTypeId),
        items: validItems,
      });

      toast.success("Compra registrada exitosamente");
      router.push("/purchases/list");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la compra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto w-full space-y-6 pb-12">

      {/* BLOQUE A: Información del Proveedor */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 shadow-xs space-y-5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs border border-blue-100 dark:border-blue-900/60">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Información del Proveedor</h2>
              <p className="text-xs text-muted-foreground">Escribe el RUC o nombre comercial para vincular los datos del proveedor</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50/60 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 border-blue-200 dark:border-blue-800/60 flex items-center gap-1.5 font-medium transition-all shadow-2xs"
            onClick={() => {
              setPrefilledSupplierQuery("");
              setSupplierDialogOpen(true);
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> + Nuevo Proveedor
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="supplier" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Buscar o Escribir RUC / Razón Social del Proveedor</span>
              <span className="text-rose-500">*</span>
            </Label>
            <SupplierSearchSelect
              selectedSupplierId={supplierId}
              onSelectSupplier={(supplier) => {
                setSupplierId(supplier.id);
              }}
              onRequestCreateSupplier={(suggestedQuery) => {
                setPrefilledSupplierQuery(suggestedQuery);
                setSupplierDialogOpen(true);
              }}
              initialSuppliersList={activeSuppliers}
            />
          </div>

          {/* Ficha de Información Fiscal y Contacto */}
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Info className="h-3.5 w-3.5 text-blue-500" />
                <span>Datos Fiscales y de Contacto del Proveedor</span>
              </div>
              {selectedSupplier && (
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Proveedor Vinculado
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>RUC / Documento</span>
                </div>
                <Input
                  readOnly
                  disabled
                  placeholder="Sin proveedor seleccionado"
                  value={selectedSupplier?.ruc || ""}
                  className="h-9 bg-background/90 font-mono text-xs cursor-default font-medium border-slate-200 dark:border-slate-800"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Dirección Fiscal</span>
                </div>
                <Input
                  readOnly
                  disabled
                  placeholder="Sin dirección registrada"
                  value={selectedSupplier?.address || ""}
                  className="h-9 bg-background/90 text-xs cursor-default font-medium border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-0.5">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Persona de Contacto</span>
                </div>
                <Input
                  readOnly
                  disabled
                  placeholder="No asignado"
                  value={selectedSupplier?.contactPerson || ""}
                  className="h-9 bg-background/90 text-xs cursor-default font-medium border-slate-200 dark:border-slate-800"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Teléfono</span>
                </div>
                <Input
                  readOnly
                  disabled
                  placeholder="No asignado"
                  value={selectedSupplier?.phone || ""}
                  className="h-9 bg-background/90 text-xs cursor-default font-medium border-slate-200 dark:border-slate-800"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Correo Electrónico</span>
                </div>
                <Input
                  readOnly
                  disabled
                  placeholder="No asignado"
                  value={selectedSupplier?.email || ""}
                  className="h-9 bg-background/90 text-xs cursor-default font-medium border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE B: Comprobante y Método de Pago */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 shadow-xs space-y-6 transition-all">
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-100 dark:border-amber-900/60">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Comprobante y Método de Pago</h2>
            <p className="text-xs text-muted-foreground">Ingresa los datos fiscales del comprobante físico y la modalidad de pago</p>
          </div>
        </div>

        {/* Sub-tarjetas equilibradas en Bloque B */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sub-sección 1: Datos del Comprobante */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
              <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Datos del Comprobante Fiscal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="voucherType" className="text-xs font-medium text-foreground">
                  Tipo de Comprobante <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={voucherType || "Factura"}
                  onValueChange={(val) => setVoucherType(val || "Factura")}
                >
                  <SelectTrigger id="voucherType" className="h-9 text-xs bg-background font-medium">
                    <SelectValue placeholder="Seleccionar Comprobante">
                      {voucherType}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Factura">Factura</SelectItem>
                    <SelectItem value="Boleta">Boleta</SelectItem>
                    <SelectItem value="Otro">Otro Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issuedAt" className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>Fecha de Emisión</span>
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="issuedAt"
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="h-9 text-xs bg-background font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="series" className="text-xs font-medium text-foreground">
                  Serie <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="series"
                  placeholder="Ej: F001 / B001"
                  maxLength={4}
                  value={series}
                  onChange={(e) => setSeries(e.target.value.toUpperCase())}
                  className="h-9 font-mono uppercase text-xs bg-background font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="number" className="text-xs font-medium text-foreground">
                  Número de Comprobante <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="number"
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Ej: 0012345"
                  value={number}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setNumber(onlyDigits);
                  }}
                  className="h-9 font-mono text-xs bg-background font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Sub-sección 2: Modalidad de Pago */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Modalidad y Medio de Pago</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Condición de Pago <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentCondition("Contado")}
                    className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      paymentCondition === "Contado"
                        ? "bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/70 shadow-xs"
                        : "bg-background text-muted-foreground border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <Banknote className={`h-3.5 w-3.5 ${paymentCondition === "Contado" ? "text-amber-700 dark:text-amber-400" : ""}`} />
                    <span>Contado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentCondition("Credito")}
                    className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      paymentCondition === "Credito"
                        ? "bg-indigo-100/90 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700/70 shadow-xs"
                        : "bg-background text-muted-foreground border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <Layers className={`h-3.5 w-3.5 ${paymentCondition === "Credito" ? "text-indigo-700 dark:text-indigo-400" : ""}`} />
                    <span>Crédito</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paymentTypeId" className="text-xs font-medium text-foreground">
                  Tipo de Pago Concreto <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={paymentTypeId ? String(paymentTypeId) : ""}
                  onValueChange={(val) => setPaymentTypeId(val ? Number(val) : "")}
                >
                  <SelectTrigger id="paymentTypeId" className="h-9 text-xs bg-background font-medium">
                    <SelectValue placeholder="Seleccionar tipo de pago">
                      {selectedPaymentType ? selectedPaymentType.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allowedPaymentTypes.map((pt) => (
                      <SelectItem key={pt.id} value={String(pt.id)}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-slate-100/70 dark:bg-slate-800/50 p-2.5 rounded-lg flex items-center gap-2 border border-slate-200/50 dark:border-slate-800">
              <Info className="h-3.5 w-3.5 text-amber-600/90 dark:text-amber-400 shrink-0" />
              <span>
                {paymentCondition === "Contado"
                  ? "Se registrará el egreso y pago de forma inmediata."
                  : "Se generará la cuenta por pagar sin desembolso inicial."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE C: Detalle de Insumos */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-card p-6 shadow-xs space-y-5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs border border-emerald-100 dark:border-emerald-900/60">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Detalle de Insumos</h2>
              <p className="text-xs text-muted-foreground">Agrega las líneas de insumos recibidos con sus cantidades, precios y afectación IGV</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLine}
            className="h-8.5 px-3.5 text-xs bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 font-semibold transition-all shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" /> + Agregar Fila
          </Button>
        </div>

        {lines.length === 0 ? (
          <div className="py-12 border border-dashed rounded-xl flex flex-col items-center gap-3 text-center bg-muted/10">
            <div className="rounded-full bg-muted p-4">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">No hay líneas de insumos agregadas</p>
              <p className="text-xs text-muted-foreground mt-1">Agrega al menos una línea para poder registrar la compra.</p>
            </div>
            <Button size="sm" onClick={handleAddLine} className="mt-1 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-3.5 w-3.5" /> Agregar Línea
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-visible bg-background shadow-2xs">
            <table className="w-full caption-bottom text-sm overflow-visible">
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800">
                  <TableHead className="w-12 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">N°</TableHead>
                  <TableHead className="min-w-[280px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Insumo / Producto</TableHead>
                  <TableHead className="w-28 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cantidad</TableHead>
                  <TableHead className="w-32 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Precio Unit. (S/)</TableHead>
                  <TableHead className="w-36 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Afectación IGV</TableHead>
                  <TableHead className="w-28 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subtotal</TableHead>
                  <TableHead className="w-24 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">IGV (18%)</TableHead>
                  <TableHead className="w-32 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Monto Final</TableHead>
                  <TableHead className="w-12 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="overflow-visible divide-y divide-slate-100 dark:divide-slate-800/60">
                {calculatedLines.map((line, index) => (
                  <TableRow key={index} className="h-16 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors overflow-visible">
                    <TableCell className="text-center font-medium text-xs text-muted-foreground">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/60 text-[11px] font-semibold">
                        {index + 1}
                      </span>
                    </TableCell>

                    <TableCell className="overflow-visible relative py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0 relative">
                          <SupplySearchSelect
                            selectedSupplyId={line.supplyId}
                            onSelectSupply={(supply) => handleSupplySelectForLine(index, supply)}
                            onRequestCreateSupply={(suggestedName) =>
                              handleOpenSupplyDialog(index, suggestedName)
                            }
                            initialSuppliesList={activeSupplies}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                          title="Crear nuevo insumo en catálogo"
                          onClick={() => handleOpenSupplyDialog(index, "")}
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineValueChange(
                            index,
                            "quantity",
                            parseFloat(e.target.value) || ""
                          )
                        }
                        className="h-9 text-right font-mono text-xs bg-background font-medium border-slate-200 dark:border-slate-800"
                      />
                    </TableCell>

                    <TableCell className="py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unitPrice}
                        onChange={(e) =>
                          handleLineValueChange(
                            index,
                            "unitPrice",
                            parseFloat(e.target.value) || ""
                          )
                        }
                        className="h-9 text-right font-mono text-xs bg-background font-medium border-slate-200 dark:border-slate-800"
                      />
                    </TableCell>

                    <TableCell className="text-center py-2">
                      <Select
                        value={line.affectationIgv || AffectationIgv.Excluded}
                        onValueChange={(val) =>
                          handleLineValueChange(
                            index,
                            "affectationIgv",
                            (val as AffectationIgv) || AffectationIgv.Excluded
                          )
                        }
                      >
                        <SelectTrigger className={`h-9 text-xs w-[124px] mx-auto font-medium border ${
                          line.affectationIgv === AffectationIgv.Included
                            ? "bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                            : "bg-slate-50/50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800"
                        }`}>
                          <SelectValue>
                            {line.affectationIgv === AffectationIgv.Included ? "Incluido" : "Excluido"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AffectationIgv.Included}>
                            <span className="font-semibold text-blue-700">Incluido</span>
                          </SelectItem>
                          <SelectItem value={AffectationIgv.Excluded}>
                            <span className="font-semibold text-slate-700">Excluido</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-foreground font-medium py-2">
                      S/ {line.subtotalLine.toFixed(2)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-muted-foreground py-2">
                      S/ {line.igvLine.toFixed(2)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-bold text-foreground py-2">
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60 px-2 py-1 rounded-md">
                        S/ {line.finalAmountLine.toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell className="text-center py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLine(index)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Eliminar fila"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}

        {/* Totales y Resumen Financiero */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Cálculo matemático en tiempo real</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              Los subtotales e impuestos se calculan automáticamente según la afectación IGV de cada ítem.
            </p>
          </div>

          <div className="w-full sm:w-88 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-card via-card to-amber-50/30 dark:to-amber-950/10 p-4.5 space-y-2.5 shadow-xs">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal Insumos:</span>
              <span className="font-mono font-medium text-foreground">
                S/ {totals.subtotalGeneral.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IGV General (18%):</span>
              <span className="font-mono font-medium text-foreground">
                S/ {totals.igvGeneral.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-baseline border-t border-slate-200 dark:border-slate-800 pt-2.5">
              <span className="font-bold text-sm text-foreground">Monto Total:</span>
              <span className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
                S/ {totals.totalGeneral.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
          className="h-11 px-6 rounded-xl font-medium text-sm border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || !isValid}
          className="h-11 px-8 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-sm shadow-md hover:shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Compra
        </Button>
      </div>

      {/* Diálogos Modal */}
      <SupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
        prefilledRucOrName={prefilledSupplierQuery}
      />

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleSupplyCreated}
        prefilledName={prefilledSupplyName}
      />
    </form>
  );
}
