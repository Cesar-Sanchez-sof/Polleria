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
import { SheetRecepcionar } from "./SheetRecepcionar";
import { Search, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrdenCompra {
  id_orden_compra: number;
  numero_orden: string;
  fecha_emision: Date | string;
  estado: "Pendiente" | "RecibidaParcial" | "RecibidaTotal" | "Cancelada";
  total: number | string;
  proveedor: {
    razon_social: string;
    ruc: string;
  };
  detalles_orden: Array<{
    id_detalle_orden_compra: number;
    id_insumo: number;
    cantidad_pedida: number | string;
    precio_unitario: number | string;
    insumo: {
      nombre: string;
      unidad_medida: string;
    };
    detalles_recepcion_compra?: Array<{
      cantidad_recibida: number | string;
    }>;
  }>;
}

interface TablaRecepcionProps {
  initialOrdenes: OrdenCompra[];
}

export function TablaRecepcion({ initialOrdenes }: TablaRecepcionProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = initialOrdenes.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.numero_orden.toLowerCase().includes(q) ||
      o.proveedor.razon_social.toLowerCase().includes(q)
    );
  });

  const handleRecepcionarClick = (orden: OrdenCompra) => {
    setOrdenSeleccionada(orden);
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
                const fecha = new Date(o.fecha_emision).toLocaleDateString("es-PE");
                const totalNum = Number(o.total);

                return (
                  <TableRow key={o.id_orden_compra}>
                    <TableCell className="font-mono font-semibold">{o.numero_orden}</TableCell>
                    <TableCell>{fecha}</TableCell>
                    <TableCell>
                      <span className="font-medium">{o.proveedor.razon_social}</span>
                    </TableCell>
                    <TableCell className="font-semibold">S/ {totalNum.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={o.estado === "Pendiente" ? "outline" : "secondary"}
                        className={
                          o.estado === "RecibidaParcial"
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : ""
                        }
                      >
                        {o.estado === "Pendiente"
                          ? "Pendiente"
                          : o.estado === "RecibidaParcial"
                          ? "Recibida Parcial"
                          : o.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleRecepcionarClick(o)}
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

      <SheetRecepcionar
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orden={ordenSeleccionada}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
