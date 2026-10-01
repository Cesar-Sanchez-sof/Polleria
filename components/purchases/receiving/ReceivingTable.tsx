"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ReceivingSheet } from "./ReceivingSheet";
import { Search, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { PurchaseOrderStatus } from "@prisma/client";

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  issuedAt: Date | string;
  status: PurchaseOrderStatus | "Pending" | "PartiallyReceived" | "FullyReceived" | "Cancelled";
  total: number | string;
  supplier: {
    businessName: string;
    ruc: string;
  };
  items: Array<{
    id: number;
    supplyId: number;
    quantityOrdered: number | string;
    unitPrice: number | string;
    supply: {
      name: string;
      unitOfMeasure: string;
    };
    receiptItems?: Array<{
      quantityReceived: number | string;
    }>;
  }>;
}

interface ReceivingTableProps {
  initialOrders: PurchaseOrder[];
}

const statusLabel: Record<string, string> = {
  Pending: "Pendiente",
  PartiallyReceived: "Recibida Parcial",
  FullyReceived: "Recibida Total",
  Cancelled: "Cancelada",
};

export function ReceivingTable({ initialOrders }: ReceivingTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = initialOrders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.supplier.businessName.toLowerCase().includes(q)
    );
  });

  const handleReceiveClick = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° Orden o Proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Orden</TableHead>
              <TableHead>Fecha Emisión</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Total Orden</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No hay órdenes de compra pendientes por recepcionar.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => {
                const date = new Date(o.issuedAt).toLocaleDateString("es-PE");
                const totalNum = Number(o.total);
                const status = String(o.status);

                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-semibold">{o.orderNumber}</TableCell>
                    <TableCell>{date}</TableCell>
                    <TableCell>
                      <span className="font-medium">{o.supplier.businessName}</span>
                    </TableCell>
                    <TableCell className="font-semibold">S/ {totalNum.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status === "Pending" ? "outline" : "secondary"}
                        className={
                          status === "PartiallyReceived"
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : ""
                        }
                      >
                        {statusLabel[status] || status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleReceiveClick(o)}
                        className="flex items-center gap-1.5 ml-auto text-xs"
                      >
                        <PackageCheck className="h-4 w-4" /> Recepcionar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ReceivingSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        order={selectedOrder}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
