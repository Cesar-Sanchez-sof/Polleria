"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
import { Spinner } from "@/components/ui/spinner";
import { annulInformalPurchase } from "@/lib/services/purchases/purchase-without-voucher";
import { InformalPurchaseType, ExpenseCategory } from "@prisma/client";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/services/purchases/purchase-without-voucher.constants";
import { toast } from "sonner";
import {
  Search,
  Package,
  Briefcase,
  Ban,
  Receipt,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Eye,
  Info,
} from "lucide-react";

export interface InformalPurchaseItem {
  id: number;
  purchaseType: InformalPurchaseType;
  expenseCategory?: ExpenseCategory | null;
  itemDescription?: string | null;
  quantity: number | string;
  amountPaid: number | string;
  unitCost?: number | string;
  date: Date | string;
  informalPlaceOrVendor?: string | null;
  reason?: string | null;
  annulled: boolean;
  annulledAt?: Date | string | null;
  annulledById?: number | null;
  annulmentReason?: string | null;
  product?: {
    id: number;
    name: string;
    unitOfMeasure: string;
  } | null;
  employee: {
    firstName: string;
    paternalLastName?: string | null;
  };
  annulledBy?: {
    firstName: string;
    paternalLastName?: string | null;
  } | null;
}

interface PurchasesWithoutVoucherTableProps {
  purchases: InformalPurchaseItem[];
}

export function PurchasesWithoutVoucherTable({
  purchases,
}: PurchasesWithoutVoucherTableProps) {
  const router = useRouter();

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Estado del diálogo de anulación
  const [purchaseToAnnul, setPurchaseToAnnul] = useState<InformalPurchaseItem | null>(null);
  const [annulReason, setAnnulReason] = useState("");
  const [annulLoading, setAnnulLoading] = useState(false);

  // Estado del diálogo de ver detalle de anulación
  const [purchaseToViewAnnulment, setPurchaseToViewAnnulment] = useState<InformalPurchaseItem | null>(null);

  // KPIs
  const activePurchases = useMemo(
    () => purchases.filter((p) => !p.annulled),
    [purchases]
  );
  const totalAmountActive = useMemo(
    () => activePurchases.reduce((acc, p) => acc + Number(p.amountPaid), 0),
    [activePurchases]
  );
  const inventoryPurchasesCount = useMemo(
    () => activePurchases.filter((p) => p.purchaseType === InformalPurchaseType.InventoryItem).length,
    [activePurchases]
  );
  const expensePurchasesCount = useMemo(
    () => activePurchases.filter((p) => p.purchaseType === InformalPurchaseType.OperatingExpense).length,
    [activePurchases]
  );
  const annulledCount = useMemo(
    () => purchases.filter((p) => p.annulled).length,
    [purchases]
  );

  // Filtrado de la tabla
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      // Filtro por tipo
      if (typeFilter !== "ALL" && item.purchaseType !== typeFilter) {
        return false;
      }

      // Filtro por estado
      if (statusFilter === "ACTIVE" && item.annulled) {
        return false;
      }
      if (statusFilter === "ANNULLED" && !item.annulled) {
        return false;
      }

      // Buscador
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const productName = item.product?.name.toLowerCase() || "";
        const description = item.itemDescription?.toLowerCase() || "";
        const place = item.informalPlaceOrVendor?.toLowerCase() || "";
        const reason = item.reason?.toLowerCase() || "";
        const categoryLabel = item.expenseCategory
          ? (EXPENSE_CATEGORY_LABELS[item.expenseCategory] || "").toLowerCase()
          : "";

        const matches =
          productName.includes(query) ||
          description.includes(query) ||
          place.includes(query) ||
          reason.includes(query) ||
          categoryLabel.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [purchases, typeFilter, statusFilter, searchTerm]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  // Manejo de anulación
  const handleOpenAnnulDialog = (purchase: InformalPurchaseItem) => {
    setPurchaseToAnnul(purchase);
    setAnnulReason("");
  };

  const handleConfirmAnnul = async () => {
    if (!purchaseToAnnul) return;
    if (!annulReason.trim()) {
      toast.error("El motivo de anulación es obligatorio");
      return;
    }

    setAnnulLoading(true);
    try {
      await annulInformalPurchase(purchaseToAnnul.id, annulReason.trim());
      toast.success("Compra menor anulada exitosamente");
      setPurchaseToAnnul(null);
      setAnnulReason("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al anular compra menor");
    } finally {
      setAnnulLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Monto Total Vigente</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold">
            S/ {totalAmountActive.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activePurchases.length} compras activas
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Insumos de Cocina</span>
            <Package className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold">
            {inventoryPurchasesCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Ingresaron a stock
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Gastos Operativos</span>
            <Briefcase className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold">
            {expensePurchasesCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Servicios y consumos
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Compras Anuladas</span>
            <Ban className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold">
            {annulledCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Con stock revertido
          </p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border rounded-lg p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por insumo, descripción, lugar..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control: Tipo */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setTypeFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                typeFilter === "ALL"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter(InformalPurchaseType.InventoryItem);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                typeFilter === InformalPurchaseType.InventoryItem
                  ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Insumos
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter(InformalPurchaseType.OperatingExpense);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                typeFilter === InformalPurchaseType.OperatingExpense
                  ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gastos
            </button>
          </div>

          {/* Segmented Control: Estado */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todo Estado
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ACTIVE");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activos
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ANNULLED");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ANNULLED"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anulados
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[95px]">Fecha</TableHead>
              <TableHead className="w-[90px]">Tipo</TableHead>
              <TableHead>Insumo / Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead>Lugar / Proveedor</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead className="w-[85px] text-center">Estado</TableHead>
              <TableHead className="w-[80px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-xs">
                  {purchases.length === 0
                    ? "No se registran compras menores sin comprobante."
                    : "No se encontraron compras con los filtros seleccionados."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPurchases.map((c) => {
                const dateStr = new Date(c.date).toLocaleDateString("es-PE");
                const qty = Number(c.quantity);
                const amount = Number(c.amountPaid);
                const unitCost =
                  c.unitCost !== undefined
                    ? Number(c.unitCost)
                    : qty > 0
                    ? amount / qty
                    : 0;

                const isInventory = c.purchaseType === InformalPurchaseType.InventoryItem;
                const displayName = isInventory
                  ? c.product?.name || "Insumo eliminado"
                  : c.itemDescription || "Gasto operativo";

                const categoryLabel =
                  !isInventory && c.expenseCategory
                    ? EXPENSE_CATEGORY_LABELS[c.expenseCategory] || c.expenseCategory
                    : "-";

                const employeeName = c.employee
                  ? `${c.employee.firstName} ${c.employee.paternalLastName || ""}`.trim()
                  : "-";

                return (
                  <TableRow
                    key={c.id}
                    className={c.annulled ? "opacity-60 bg-muted/20" : undefined}
                  >
                    <TableCell className="text-xs whitespace-nowrap">{dateStr}</TableCell>
                    <TableCell>
                      {isInventory ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                          <Package className="h-3 w-3" /> Insumo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          <Briefcase className="h-3 w-3" /> Gasto
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      {displayName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {categoryLabel}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {isInventory ? `${qty.toFixed(2)} ${c.product?.unitOfMeasure || ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs whitespace-nowrap">
                      S/ {amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {isInventory ? `S/ ${unitCost.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.informalPlaceOrVendor || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {employeeName}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.annulled ? (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-muted-foreground/30">
                          Anulado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Activo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.annulled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPurchaseToViewAnnulment(c)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 px-2 flex items-center gap-1 cursor-pointer"
                          title="Ver detalle de anulación"
                        >
                          <Eye className="h-3.5 w-3.5 text-rose-500" />
                          <span>Ver anulación</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAnnulDialog(c)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Anular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredPurchases.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="compras"
        />
      </div>

      {/* Diálogo de Anulación */}
      <Dialog open={!!purchaseToAnnul} onOpenChange={(open) => !open && setPurchaseToAnnul(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Anular Compra Menor &ldquo;
              {purchaseToAnnul?.purchaseType === InformalPurchaseType.InventoryItem
                ? purchaseToAnnul?.product?.name
                : purchaseToAnnul?.itemDescription}
              &rdquo;
            </DialogTitle>
            <DialogDescription>
              Esta acción marcará la compra como anulada y dejará constancia en el historial.
            </DialogDescription>
          </DialogHeader>

          {purchaseToAnnul && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-md text-xs space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-semibold">
                    {purchaseToAnnul.purchaseType === InformalPurchaseType.InventoryItem
                      ? "Insumo de cocina"
                      : "Gasto operativo"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descripción:</span>
                  <span className="font-semibold">
                    {purchaseToAnnul.purchaseType === InformalPurchaseType.InventoryItem
                      ? purchaseToAnnul.product?.name
                      : purchaseToAnnul.itemDescription}
                  </span>
                </div>
                {purchaseToAnnul.purchaseType === InformalPurchaseType.InventoryItem && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="font-semibold">
                      {Number(purchaseToAnnul.quantity).toFixed(2)}{" "}
                      {purchaseToAnnul.product?.unitOfMeasure}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto Pagado:</span>
                  <span className="font-semibold text-foreground">
                    S/ {Number(purchaseToAnnul.amountPaid).toFixed(2)}
                  </span>
                </div>
              </div>

              {purchaseToAnnul.purchaseType === InformalPurchaseType.InventoryItem && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <RotateCcw className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Reversión de Inventario:</strong> Se restarán{" "}
                    {Number(purchaseToAnnul.quantity).toFixed(2)}{" "}
                    {purchaseToAnnul.product?.unitOfMeasure} del stock actual. Si no hay
                    stock suficiente, la anulación será rechazada.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="annulReason">Motivo de la anulación *</Label>
                <Textarea
                  id="annulReason"
                  placeholder="Ej: Error en el registro de cantidad, compra devuelta, evento suspendido..."
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  rows={3}
                  maxLength={200}
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPurchaseToAnnul(null)}
              disabled={annulLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmAnnul}
              disabled={annulLoading || !annulReason.trim()}
            >
              {annulLoading && <Spinner className="mr-2 h-4 w-4" />}
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Detalle de Anulación */}
      <Dialog
        open={!!purchaseToViewAnnulment}
        onOpenChange={(open) => !open && setPurchaseToViewAnnulment(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Ban className="h-5 w-5" />
              Detalle de Anulación
            </DialogTitle>
            <DialogDescription>
              Constancia de la anulación realizada y datos de auditoría de la compra menor.
            </DialogDescription>
          </DialogHeader>

          {purchaseToViewAnnulment && (
            <div className="space-y-4 py-2 text-xs">
              {/* Bloque destacado con la auditoría de anulación */}
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-900 dark:text-rose-200 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-900/40">
                  <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Estado: Anulada
                  </span>
                  {purchaseToViewAnnulment.annulledAt && (
                    <span className="font-mono text-[11px] text-rose-700 dark:text-rose-400">
                      {new Date(purchaseToViewAnnulment.annulledAt).toLocaleString("es-PE")}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Anulado por:</span>
                  <span className="font-semibold text-foreground text-xs">
                    {purchaseToViewAnnulment.annulledBy
                      ? `${purchaseToViewAnnulment.annulledBy.firstName} ${purchaseToViewAnnulment.annulledBy.paternalLastName || ""}`
                      : "Usuario del sistema"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Motivo de la anulación:</span>
                  <p className="mt-1 p-2.5 rounded-lg bg-background/80 border border-rose-200/70 dark:border-rose-900/60 text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                    {purchaseToViewAnnulment.annulmentReason || "Sin motivo registrado"}
                  </p>
                </div>
              </div>

              {/* Contexto: Datos básicos de la compra */}
              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
                <span className="font-semibold text-foreground text-[11px] block uppercase tracking-wide">
                  Datos de la Compra Original
                </span>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Tipo:</span>
                    <span className="font-medium text-foreground">
                      {purchaseToViewAnnulment.purchaseType === InformalPurchaseType.InventoryItem
                        ? "Insumo de cocina"
                        : "Gasto operativo"}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block">Fecha de Compra:</span>
                    <span className="font-medium text-foreground">
                      {new Date(purchaseToViewAnnulment.date).toLocaleDateString("es-PE", { timeZone: "UTC" })}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-muted-foreground block">Insumo / Descripción:</span>
                    <span className="font-semibold text-foreground">
                      {purchaseToViewAnnulment.purchaseType === InformalPurchaseType.InventoryItem
                        ? purchaseToViewAnnulment.product?.name
                        : purchaseToViewAnnulment.itemDescription}
                    </span>
                  </div>

                  {purchaseToViewAnnulment.purchaseType === InformalPurchaseType.InventoryItem && (
                    <div>
                      <span className="text-muted-foreground block">Cantidad Revertida:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {Number(purchaseToViewAnnulment.quantity).toFixed(2)}{" "}
                        {purchaseToViewAnnulment.product?.unitOfMeasure}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground block">Monto Pagado:</span>
                    <span className="font-mono font-bold text-foreground">
                      S/ {Number(purchaseToViewAnnulment.amountPaid).toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block">Registrado por:</span>
                    <span className="font-medium text-foreground">
                      {purchaseToViewAnnulment.employee.firstName}{" "}
                      {purchaseToViewAnnulment.employee.paternalLastName || ""}
                    </span>
                  </div>

                  {purchaseToViewAnnulment.informalPlaceOrVendor && (
                    <div>
                      <span className="text-muted-foreground block">Lugar / Proveedor:</span>
                      <span className="font-medium text-foreground">
                        {purchaseToViewAnnulment.informalPlaceOrVendor}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPurchaseToViewAnnulment(null)}
              className="text-xs"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
