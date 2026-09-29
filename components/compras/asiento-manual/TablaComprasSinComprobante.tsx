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

interface CompraSinComprobante {
  id_compra_menor: number;
  cantidad: number | string;
  monto_pagado: number | string;
  fecha: Date | string;
  lugar_o_proveedor_informal?: string | null;
  motivo?: string | null;
  insumo: {
    nombre: string;
    unidad_medida: string;
  };
  empleado: {
    primer_nombre: string;
    apellido_paterno: string;
  };
}

interface TablaComprasSinComprobanteProps {
  compras: CompraSinComprobante[];
}

export function TablaComprasSinComprobante({ compras }: TablaComprasSinComprobanteProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Historial de Compras Sin Comprobante</h2>

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
            {compras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No se registran compras menores sin comprobante.
                </TableCell>
              </TableRow>
            ) : (
              compras.map((c) => {
                const fechaStr = new Date(c.fecha).toLocaleDateString("es-PE");
                const cant = Number(c.cantidad);
                const monto = Number(c.monto_pagado);
                const costoU = cant > 0 ? monto / cant : 0;

                return (
                  <TableRow key={c.id_compra_menor}>
                    <TableCell className="text-xs">{fechaStr}</TableCell>
                    <TableCell className="font-medium">{c.insumo.nombre}</TableCell>
                    <TableCell className="text-right">
                      {cant.toFixed(2)} {c.insumo.unidad_medida}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      S/ {monto.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      S/ {costoU.toFixed(2)}
                    </TableCell>
                    <TableCell>{c.lugar_o_proveedor_informal || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.motivo || "Compra menor de emergencia"}
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
