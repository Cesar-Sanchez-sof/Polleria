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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  anulado: boolean;
  anuladoAt?: Date | string | null;
  anuladoPor?: number | null;
  motivoAnulacion?: string | null;
  supply?: {
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

  // KPIs
  const activePurchases = useMemo(
    () => purchases.filter((p) => !p.anulado),
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
    () => purchases.filter((p) => p.anulado).length,
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
      if (statusFilter === "ACTIVE" && item.anulado) {
        return false;
      }
      if (statusFilter === "ANNULLED" && !item.anulado) {
        return false;
      }

      // Buscador
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const supplyName = item.supply?.name.toLowerCase() || "";
        const description = item.itemDescription?.toLowerCase() || "";
        const place = item.informalPlaceOrVendor?.toLowerCase() || "";
        const reason = item.reason?.toLowerCase() || "";
        const categoryLabel = item.expenseCategory
          ? (EXPENSE_CATEGORY_LABELS[item.expenseCategory] || "").toLowerCase()
          : "";

        const matches =
          supplyName.includes(query) ||
          description.includes(query) ||
          place.includes(query) ||
          reason.includes(query) ||
          categoryLabel.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [purchases, typeFilter, statusFilter, searchTerm]);

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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[140px]">
            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || "ALL")}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value={InformalPurchaseType.InventoryItem}>Solo insumos</SelectItem>
                <SelectItem value={InformalPurchaseType.OperatingExpense}>Solo gastos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[140px]">
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "ALL")}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="ACTIVE">Solo activos</SelectItem>
                <SelectItem value="ANNULLED">Solo anulados</SelectItem>
              </SelectContent>
            </Select>
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
              filteredPurchases.map((c) => {
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
                  ? c.supply?.name || "Insumo eliminado"
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
                    className={c.anulado ? "opacity-60 bg-muted/20" : undefined}
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
                      {isInventory ? `${qty.toFixed(2)} ${c.supply?.unitOfMeasure || ""}` : "-"}
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
                      {c.anulado ? (
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
                      {c.anulado ? (
                        <span
                          className="text-[10px] text-muted-foreground italic cursor-help"
                          title={`Motivo: ${c.motivoAnulacion || "Sin motivo"}`}
                        >
                          Anulada
                        </span>
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
      </div>

      {/* Diálogo de Anulación */}
      <Dialog open={!!purchaseToAnnul} onOpenChange={(open) => !open && setPurchaseToAnnul(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Anular Compra Menor #{purchaseToAnnul?.id}
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
                      ? purchaseToAnnul.supply?.name
                      : purchaseToAnnul.itemDescription}
                  </span>
                </div>
                {purchaseToAnnul.purchaseType === InformalPurchaseType.InventoryItem && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="font-semibold">
                      {Number(purchaseToAnnul.quantity).toFixed(2)}{" "}
                      {purchaseToAnnul.supply?.unitOfMeasure}
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
                    {purchaseToAnnul.supply?.unitOfMeasure} del stock actual. Si no hay
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
    </div>
  );
}
