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
import { DialogProveedor } from "./DialogProveedor";
import { cambiarEstadoProveedor } from "@/lib/services/compras/proveedor";
import { toast } from "sonner";
import { Plus, Search, Edit2, Power } from "lucide-react";

interface Proveedor {
  id_proveedor: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string | null;
  nombre?: string | null;
  persona_contacto?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  estado: boolean;
}

interface TablaProveedoresProps {
  initialProveedores: Proveedor[];
}

export function TablaProveedores({ initialProveedores }: TablaProveedoresProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [proveedorAEditar, setProveedorAEditar] = useState<Proveedor | null>(null);

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.ruc.toLowerCase().includes(q) ||
      p.razon_social.toLowerCase().includes(q) ||
      (p.persona_contacto && p.persona_contacto.toLowerCase().includes(q))
    );
  });

  const handleNuevo = () => {
    setProveedorAEditar(null);
    setDialogOpen(true);
  };

  const handleEditar = (proveedor: Proveedor) => {
    setProveedorAEditar(proveedor);
    setDialogOpen(true);
  };

  const handleToggleEstado = async (proveedor: Proveedor) => {
    const nuevoEstado = !proveedor.estado;
    try {
      await cambiarEstadoProveedor(proveedor.id_proveedor, nuevoEstado);
      setProveedores((prev) =>
        prev.map((p) =>
          p.id_proveedor === proveedor.id_proveedor ? { ...p, estado: nuevoEstado } : p
        )
      );
      toast.success(
        `Proveedor ${nuevoEstado ? "activado" : "desactivado"} exitosamente`
      );
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado");
    }
  };

  const handleSuccess = (guardado?: Proveedor) => {
    if (!guardado) return;
    setProveedores((prev) => {
      const idx = prev.findIndex((p) => p.id_proveedor === guardado.id_proveedor);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = guardado;
        return copy;
      }
      return [guardado, ...prev];
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por RUC, Razón Social o Contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={handleNuevo} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo Proveedor
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Documento</TableHead>
              <TableHead>Razón Social / Proveedor</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono / Correo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No se encontraron proveedores registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id_proveedor}>
                  <TableCell className="font-mono font-medium">
                    <span className="text-xs text-muted-foreground block">
                      {p.ruc.length === 8 ? "DNI" : "RUC"}
                    </span>
                    {p.ruc}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-foreground">{p.razon_social}</span>
                  </TableCell>
                  <TableCell>{p.persona_contacto || "-"}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {p.telefono && <div>Tel: {p.telefono}</div>}
                      {p.correo && <div className="text-muted-foreground">{p.correo}</div>}
                      {!p.telefono && !p.correo && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.estado
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                          : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                      }
                    >
                      {p.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditar(p)}
                      title="Editar proveedor"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleEstado(p)}
                      className={p.estado ? "text-destructive" : "text-emerald-600"}
                      title={p.estado ? "Desactivar" : "Activar"}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DialogProveedor
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proveedorAEditar={proveedorAEditar}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
