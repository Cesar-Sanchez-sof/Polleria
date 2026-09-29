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
import { DialogNuevoComprobante } from "./DialogNuevoComprobante";
import { DialogRegistrarPago } from "./DialogRegistrarPago";
import { Search, Plus, CreditCard, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface Comprobante {
  id_comprobante_compra: number;
  tipo_comprobante: string;
  serie: string;
  numero: number;
  fecha_emision: Date | string;
  subtotal: number | string;
  igv: number | string;
  monto_total: number | string;
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: "Pendiente" | "Parcial" | "Pagado";
  proveedor: {
    id_proveedor: number;
    razon_social: string;
    ruc: string;
  };
  recepcion: {
    id_recepcion: number;
  };
  pagos_compra: Array<{
    id_pago_compra: number;
    monto: number | string;
    fecha_pago: Date | string;
    tipo_pago: {
      nombre: string;
    };
  }>;
}

interface TipoPago {
  id_tipo_pago: number;
  nombre: string;
}

interface TablaComprobantesProps {
  initialComprobantes: Comprobante[];
  recepcionesSinComprobante: any[];
  tiposPago: TipoPago[];
}

export function TablaComprobantes({
  initialComprobantes,
  recepcionesSinComprobante,
  tiposPago,
}: TablaComprobantesProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialogNuevoOpen, setDialogNuevoOpen] = useState(false);
  const [dialogPagoOpen, setDialogPagoOpen] = useState(false);
  const [comprobanteAPagar, setComprobanteAPagar] = useState<Comprobante | null>(null);

  const filtered = initialComprobantes.filter((c) => {
    const q = search.toLowerCase();
    const numComp = `${c.tipo_comprobante} ${c.serie}-${c.numero}`.toLowerCase();
    return (
      numComp.includes(q) ||
      c.proveedor.razon_social.toLowerCase().includes(q) ||
      c.proveedor.ruc.includes(q)
    );
  });

  const handleAbrirPago = (comp: Comprobante) => {
    setComprobanteAPagar(comp);
    setDialogPagoOpen(true);
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
            placeholder="Buscar por comprobante, RUC o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDialogNuevoOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Registrar Factura / Comprobante
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado Pago</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  No hay comprobantes de compra registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const fecha = new Date(c.fecha_emision).toLocaleDateString("es-PE");
                const totalNum = Number(c.monto_total);

                return (
                  <TableRow key={c.id_comprobante_compra}>
                    <TableCell className="font-mono font-semibold">
                      {c.tipo_comprobante} {c.serie}-{c.numero}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{c.proveedor.razon_social}</span>
                        <span className="block text-xs font-mono text-muted-foreground">
                          RUC: {c.proveedor.ruc}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{fecha}</TableCell>
                    <TableCell className="text-right font-semibold">
                      S/ {totalNum.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      S/ {c.totalPagado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {c.saldoPendiente.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {c.estadoPago === "Pagado" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Pagado
                        </span>
                      )}
                      {c.estadoPago === "Parcial" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> Parcial
                        </span>
                      )}
                      {c.estadoPago === "Pendiente" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.estadoPago !== "Pagado" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirPago(c)}
                          className="flex items-center gap-1.5 ml-auto text-xs"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pagar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Completo</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DialogNuevoComprobante
        open={dialogNuevoOpen}
        onOpenChange={setDialogNuevoOpen}
        recepcionesSinComprobante={recepcionesSinComprobante}
        tiposPago={tiposPago}
        onSuccess={handleSuccess}
      />

      <DialogRegistrarPago
        open={dialogPagoOpen}
        onOpenChange={setDialogPagoOpen}
        comprobante={comprobanteAPagar}
        tiposPago={tiposPago}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
