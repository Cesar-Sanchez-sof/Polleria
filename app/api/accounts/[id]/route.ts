import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import {
  getAccountByIdDomain,
  updateAccountDomain,
  AccountValidationError,
} from "@/lib/services/chart-of-accounts.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounts/[id]
 * Individual account lookup.
 */
export const GET = createApiHandler({
  permission: ["cuentas.ver", "asientos.ver"],
  handler: async ({ params }) => {
    try {
      const idParam = String(params.id ?? "");
      const account = await getAccountByIdDomain(idParam);
      return NextResponse.json(account);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/accounts/[id]] error al obtener la cuenta:", error);
      return NextResponse.json(
        { error: "No se pudo obtener la cuenta contable." },
        { status: 500 }
      );
    }
  },
});

/**
 * PATCH /api/accounts/[id]
 * Modifies an existing account: code, name, type, hierarchy, or status.
 */
export const PATCH = createApiHandler({
  permission: "cuentas.editar",
  handler: async ({ req, params, body }) => {
    try {
      const idParam = String(params.id ?? "");
      const rawBody = body !== undefined ? body : await req.json().catch(() => null);
      const updated = await updateAccountDomain(idParam, rawBody, requestIp(req) ?? undefined);
      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof AccountValidationError) {
        return NextResponse.json(
          { error: error.message, errors: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof DomainError) throw error;
      console.error("[api/accounts/[id]] error al actualizar la cuenta:", error);
      return NextResponse.json(
        { error: "No se pudo actualizar la cuenta contable." },
        { status: 500 }
      );
    }
  },
});
