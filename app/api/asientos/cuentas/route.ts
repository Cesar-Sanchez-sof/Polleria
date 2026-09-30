import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Chart of accounts available to build lines in a manual journal entry.
 * Returns only active accounts, ordered by code.
 */
export async function GET() {
  try {
    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

    return Response.json({
      data: accounts.map((account) => ({
        id: account.id,
        codigo: account.code,
        nombre: account.name,
        tipo: account.type,
      })),
    });
  } catch (error) {
    console.error("[api/asientos/cuentas] error al obtener el plan contable:", error);
    return Response.json(
      { error: "No se pudo obtener el plan contable." },
      { status: 500 }
    );
  }
}
