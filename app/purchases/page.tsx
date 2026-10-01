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
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getPurchaseOrders } from "@/lib/services/purchases/purchase-order";
import { getPurchaseVouchers } from "@/lib/services/purchases/invoices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchases & Inventory Module | Pollería",
};

export default async function PurchasesDashboardPage() {
  const [suppliers, supplies, orders, vouchers] = await Promise.all([
    getSuppliers().catch(() => []),
    getSupplies().catch(() => []),
    getPurchaseOrders().catch(() => []),
    getPurchaseVouchers().catch(() => []),
  ]);

  const totalSuppliers = suppliers.filter((p) => p.estado).length;
  const lowStockSupplies = supplies.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo)).length;
  const pendingOrders = orders.filter((o) => o.estado === "Pendiente" || o.estado === "RecibidaParcial").length;
  const pendingPaymentVouchers = vouchers.filter((c) => c.estadoPago !== "Pagado").length;

  const modules = [
    {
      title: "1. Gestión de Proveedores",
      description: "Catálogo completo de proveedores, RUC, contactos y estado de actividad.",
      href: "/purchases/suppliers",
      icon: Users,
      badge: `${totalSuppliers} activos`,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      title: "2. Órdenes de Compra",
      description: "Generar pedidos a proveedores con líneas de insumos y fechas esperadas.",
      href: "/purchases/add",
      icon: ShoppingCart,
      badge: `${pendingOrders} pendientes`,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    {
      title: "3. Recepción de Compra",
      description: "Registrar el ingreso físico de insumos a almacén y actualizar el Kardex.",
      href: "/purchases/receiving",
      icon: PackageCheck,
      badge: `${pendingOrders} por recepcionar`,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      title: "4. Facturas de Proveedor",
      description: "Registrar comprobantes de pago (facturas/boletas) y pagos realizados.",
      href: "/purchases/supplier-invoices",
      icon: FileText,
      badge: `${pendingPaymentVouchers} por pagar`,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      title: "5. Inventario e Insumos",
      description: "Control de stocks actuales, stocks mínimos y registro de ajustes físicos.",
      href: "/purchases/inventory",
      icon: Boxes,
      badge: lowStockSupplies > 0 ? `${lowStockSupplies} bajo stock` : `${supplies.length} insumos`,
      color: lowStockSupplies > 0 ? "text-rose-600 bg-rose-50 border-rose-200" : "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      title: "6. Transformación de Insumos",
      description: "Mini-producción para convertir materias primas en productos terminados.",
      href: "/purchases/transformation",
      icon: Repeat,
      badge: "Producción",
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      title: "7. Compra Menor Sin Comprobante",
      description: "Ingreso directo de compras informales de bajo monto al inventario.",
      href: "/purchases/purchase-without-voucher",
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

      {/* Submodules grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.href} className="hover:shadow-md transition-all border group">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-lg border ${module.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-muted/40">
                    {module.badge}
                  </span>
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {module.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={module.href} className="block w-full">
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
