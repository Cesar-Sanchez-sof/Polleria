import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShoppingCart,
  PackageCheck,
  FileText,
  Boxes,
  Repeat,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { obtenerProveedores } from "@/lib/services/compras/proveedor";
import { obtenerInsumos } from "@/lib/services/compras/insumo";
import { obtenerOrdenesCompra } from "@/lib/services/compras/orden-compra";
import { obtenerComprobantesCompra } from "@/lib/services/compras/facturas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Módulo de Compras & Inventario | Pollería",
};

export default async function ComprasDashboardPage() {
  const [proveedores, insumos, ordenes, comprobantes] = await Promise.all([
    obtenerProveedores().catch(() => []),
    obtenerInsumos().catch(() => []),
    obtenerOrdenesCompra().catch(() => []),
    obtenerComprobantesCompra().catch(() => []),
  ]);

  const totalProveedores = proveedores.filter((p) => p.estado).length;
  const insumosBajoStock = insumos.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo)).length;
  const ordenesPendientes = ordenes.filter((o) => o.estado === "Pendiente" || o.estado === "RecibidaParcial").length;
  const comprobantesPendientesPago = comprobantes.filter((c) => c.estadoPago !== "Pagado").length;

  const modulos = [
    {
      titulo: "1. Gestión de Proveedores",
      descripcion: "Catálogo completo de proveedores, RUC, contactos y estado de actividad.",
      href: "/compras/proveedores",
      icon: Users,
      badge: `${totalProveedores} activos`,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      titulo: "2. Órdenes de Compra",
      descripcion: "Generar pedidos a proveedores con líneas de insumos y fechas esperadas.",
      href: "/compras/anadir",
      icon: ShoppingCart,
      badge: `${ordenesPendientes} pendientes`,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    {
      titulo: "3. Recepción de Compra",
      descripcion: "Registrar el ingreso físico de insumos a almacén y actualizar el Kardex.",
      href: "/compras/recepcion",
      icon: PackageCheck,
      badge: `${ordenesPendientes} por recepcionar`,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      titulo: "4. Facturas de Proveedor",
      descripcion: "Registrar comprobantes de pago (facturas/boletas) y pagos realizados.",
      href: "/compras/facturas-proveedor",
      icon: FileText,
      badge: `${comprobantesPendientesPago} por pagar`,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      titulo: "5. Inventario e Insumos",
      descripcion: "Control de stocks actuales, stocks mínimos y registro de ajustes físicos.",
      href: "/compras/inventario",
      icon: Boxes,
      badge: insumosBajoStock > 0 ? `${insumosBajoStock} bajo stock` : `${insumos.length} insumos`,
      color: insumosBajoStock > 0 ? "text-rose-600 bg-rose-50 border-rose-200" : "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      titulo: "6. Transformación de Insumos",
      descripcion: "Mini-producción para convertir materias primas en productos terminados.",
      href: "/compras/transformacion",
      icon: Repeat,
      badge: "Producción",
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      titulo: "7. Compra Menor Sin Comprobante",
      descripcion: "Ingreso directo de compras informales de bajo monto al inventario.",
      href: "/compras/compra-sin-comprobante",
      icon: Receipt,
      badge: "Registro directo",
      color: "text-teal-600 bg-teal-50 border-teal-200",
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Módulo de Compras, Inventario y Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Gestión integral de abastecimiento, recepción de mercadería, facturación y control de inventarios.
        </p>
      </div>

      {/* Grid de submódulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modulos.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.href} className="hover:shadow-md transition-all border group">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-lg border ${m.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-muted/40">
                    {m.badge}
                  </span>
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {m.titulo}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {m.descripcion}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={m.href} className="block w-full">
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs font-medium">
                    Acceder al módulo <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}