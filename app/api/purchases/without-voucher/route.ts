import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Devuelve los comprobantes de compras locales para cotejo / conciliación con SIRE.
 */
export async function GET() {
  const auth = await authorize("compras.ver");
  if (!auth.ok) return auth.response;

  try {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: { active: true },
      select: {
        id: true,
        voucherType: true,
        series: true,
        number: true,
        issuedAt: true,
        totalAmount: true,
        supplier: {
          select: {
            ruc: true,
            businessName: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    const formatted = invoices.map((inv) => ({
      id: inv.id,
      voucherType: inv.voucherType,
      series: inv.series,
      number: String(inv.number),
      issuedAt: inv.issuedAt ? inv.issuedAt.toISOString().slice(0, 10) : "",
      totalAmount: Number(inv.totalAmount),
      supplierDocument: inv.supplier?.ruc ?? "",
      supplierName: inv.supplier?.businessName ?? "",
    }));

    return NextResponse.json(formatted, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error al obtener compras locales para conciliación:", error);
    return NextResponse.json(
      { error: "Error al obtener comprobantes de compra locales." },
      { status: 500 }
    );
  }
}
