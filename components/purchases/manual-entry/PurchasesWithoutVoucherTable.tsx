"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InformalPurchase {
  id: number;
  quantity: number | string;
  amountPaid: number | string;
  date: Date | string;
  informalPlaceOrVendor?: string | null;
  reason?: string | null;
  supply: {
    name: string;
    unitOfMeasure: string;
  };
  employee: {
    firstName: string;
    paternalLastName: string;
  };
}

interface PurchasesWithoutVoucherTableProps {
  purchases: InformalPurchase[];
}

export function PurchasesWithoutVoucherTable({
  purchases,
}: PurchasesWithoutVoucherTableProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">
        Historial de Compras Sin Comprobante
      </h2>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto Pagado</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead>Lugar / Proveedor</TableHead>
              <TableHead>Motivo / Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No se registran compras menores sin comprobante.
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((c) => {
                const dateStr = new Date(c.date).toLocaleDateString("es-PE");
                const qty = Number(c.quantity);
                const amount = Number(c.amountPaid);
                const unitCost = qty > 0 ? amount / qty : 0;

                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{dateStr}</TableCell>
                    <TableCell className="font-medium">{c.supply.name}</TableCell>
                    <TableCell className="text-right">
                      {qty.toFixed(2)} {c.supply.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      S/ {amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      S/ {unitCost.toFixed(2)}
                    </TableCell>
                    <TableCell>{c.informalPlaceOrVendor || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.reason || "Compra menor de emergencia"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
