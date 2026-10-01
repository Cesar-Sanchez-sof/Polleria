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
import { Badge } from "@/components/ui/badge";

interface Detalle {
  id_detalle_transformacion: number;
  tipo_detalle: string; // 'Consumo' | 'Producido'
  cantidad: number | string;
  costo_unitario?: number | string | null;
  insumo: {
    nombre: string;
    unidad_medida: string;
  };
}

interface Transformation {
  id_transformacion: number;
  fecha: Date | string;
  note?: string | null;
  empleado: {
    primer_nombre: string;
    apellido_paterno: string;
  };
  detalles_transformacion: Detalle[];
}

interface TransformationsTableProps {
  transformations: Transformation[];
}

export function TransformationsTable({ transformations }: TransformationsTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Historial de Transformaciones</h2>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Lote</TableHead>
              <TableHead>Fecha / Hora</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Consumo (Salida)</TableHead>
              <TableHead>Producido (Entrada)</TableHead>
              <TableHead className="text-right">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transformations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No hay transformations de inventario registradas.
                </TableCell>
              </TableRow>
            ) : (
              transformations.map((t) => {
                const fechaStr = new Date(t.fecha).toLocaleString("es-PE");
                const consumptions = t.detalles_transformacion.filter((d) => d.tipo_detalle === "Consumo");
                const outputs = t.detalles_transformacion.filter((d) => d.tipo_detalle === "Producido");
                const isExpanded = expandedId === t.id_transformacion;

                return (
                  <React.Fragment key={t.id_transformacion}>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(t.id_transformacion)}>
                      <TableCell className="font-mono font-semibold">TR-{t.id_transformacion.toString().padStart(4, "0")}</TableCell>
                      <TableCell className="text-xs">{fechaStr}</TableCell>
                      <TableCell>{t.empleado.primer_nombre} {t.empleado.apellido_paterno}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {consumptions.map((c) => (
                            <span key={c.id_detalle_transformacion} className="block text-rose-700 font-medium">
                              - {Number(c.cantidad)} {c.insumo.unidad_medida} {c.insumo.nombre}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {outputs.map((p) => (
                            <span key={p.id_detalle_transformacion} className="block text-emerald-700 font-medium">
                              + {Number(p.cantidad)} {p.insumo.unidad_medida} {p.insumo.nombre}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{isExpanded ? "Ocultar" : "Ver todo"}</Badge>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="p-4 border-b">
                          <div className="space-y-2 text-xs">
                            {t.observacion && (
                              <div>
                                <span className="font-semibold">Notas:</span> {t.observacion}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className="border rounded p-2 bg-white space-y-1">
                                <span className="font-semibold text-rose-800">Insumos Consumidos:</span>
                                {consumptions.map((c) => (
                                  <div key={c.id_detalle_transformacion} className="flex justify-between">
                                    <span>{c.insumo.nombre}</span>
                                    <span>{Number(c.cantidad)} {c.insumo.unidad_medida}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="border rounded p-2 bg-white space-y-1">
                                <span className="font-semibold text-emerald-800">Insumos Producidos:</span>
                                {outputs.map((p) => (
                                  <div key={p.id_detalle_transformacion} className="flex justify-between">
                                    <span>{p.insumo.nombre}</span>
                                    <span>{Number(p.cantidad)} {p.insumo.unidad_medida}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
