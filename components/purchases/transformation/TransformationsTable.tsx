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

interface TransformationItem {
  id: number;
  itemType: string; // 'Consumo' | 'Producido'
  quantity: number | string;
  unitCost?: number | string | null;
  supply: {
    name: string;
    unitOfMeasure: string;
  };
}

interface Transformation {
  id: number;
  date: Date | string;
  notes?: string | null;
  employee: {
    firstName: string;
    paternalLastName: string;
  };
  items: TransformationItem[];
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
                  No hay transformaciones de inventario registradas.
                </TableCell>
              </TableRow>
            ) : (
              transformations.map((t) => {
                const dateStr = new Date(t.date).toLocaleString("es-PE");
                const consumptions = t.items.filter((d) => d.itemType === "Consumo");
                const outputs = t.items.filter((d) => d.itemType === "Producido");
                const isExpanded = expandedId === t.id;

                return (
                  <React.Fragment key={t.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(t.id)}
                    >
                      <TableCell className="font-mono font-semibold">
                        TR-{t.id.toString().padStart(4, "0")}
                      </TableCell>
                      <TableCell className="text-xs">{dateStr}</TableCell>
                      <TableCell>
                        {t.employee.firstName} {t.employee.paternalLastName}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {consumptions.map((c) => (
                            <span
                              key={c.id}
                              className="block text-rose-700 font-medium"
                            >
                              - {Number(c.quantity)} {c.supply.unitOfMeasure} {c.supply.name}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {outputs.map((p) => (
                            <span
                              key={p.id}
                              className="block text-emerald-700 font-medium"
                            >
                              + {Number(p.quantity)} {p.supply.unitOfMeasure} {p.supply.name}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {isExpanded ? "Ocultar" : "Ver todo"}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="p-4 border-b">
                          <div className="space-y-2 text-xs">
                            {t.notes && (
                              <div>
                                <span className="font-semibold">Notas:</span> {t.notes}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className="border rounded p-2 bg-white space-y-1">
                                <span className="font-semibold text-rose-800">
                                  Insumos Consumidos:
                                </span>
                                {consumptions.map((c) => (
                                  <div key={c.id} className="flex justify-between">
                                    <span>{c.supply.name}</span>
                                    <span>
                                      {Number(c.quantity)} {c.supply.unitOfMeasure}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="border rounded p-2 bg-white space-y-1">
                                <span className="font-semibold text-emerald-800">
                                  Insumos Producidos:
                                </span>
                                {outputs.map((p) => (
                                  <div key={p.id} className="flex justify-between">
                                    <span>{p.supply.name}</span>
                                    <span>
                                      {Number(p.quantity)} {p.supply.unitOfMeasure}
                                    </span>
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
