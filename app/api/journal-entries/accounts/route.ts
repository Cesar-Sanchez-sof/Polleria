import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/auth/permissions";

/**
 * @openapi
 * /api/journal-entries/accounts:
 *   get:
 *     tags:
 *       - JournalEntries
 *     summary: Obtener lista de cuentas para asientos manuales
 *     description: Devuelve la lista de cuentas contables activas, ordenadas por código, para ser usadas al crear asientos manuales.
 *     responses:
 *       200:
 *         description: Lista de cuentas contables.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *       500:
 *         description: Error interno del servidor.
 */

/**
 * Chart of accounts available to build lines in a manual journal entry.
 * Returns only active accounts, ordered by code.
 */
export async function GET() {
  const auth = await authorize(["asientos.ver", "asientos.crear"]);
  if (!auth.ok) return auth.response;
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
        code: account.code,
        name: account.name,
        type: account.type,
      })),
    });
  } catch (error) {
    console.error("[api/journal-entries/accounts] error al obtener el plan contable:", error);
    return Response.json(
      { error: "No se pudo obtener el plan contable." },
      { status: 500 }
    );
  }
}
