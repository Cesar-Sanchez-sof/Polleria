import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import {
  listAccountsDomain,
  createAccountDomain,
  AccountValidationError,
} from "@/lib/services/chart-of-accounts.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounts
 * Full chart of accounts (roots and subaccounts), ordered by code.
 */
export const GET = createApiHandler({
  permission: ["cuentas.ver", "asientos.ver"],
  handler: async () => {
    try {
      const result = await listAccountsDomain();
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/accounts] error al obtener el plan contable:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el plan contable." },
        { status: 500 }
      );
    }
  },
});

/**
 * POST /api/accounts
 * Registers a new accounting account.
 */
export const POST = createApiHandler({
  permission: "cuentas.crear",
  handler: async ({ req, body }) => {
    try {
      const rawBody = body !== undefined ? body : await req.json().catch(() => null);
      const result = await createAccountDomain(rawBody, requestIp(req) ?? undefined);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof AccountValidationError) {
        return NextResponse.json(
          { error: error.message, errors: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof DomainError) throw error;
      console.error("[api/accounts] error al registrar la cuenta:", error);
      return NextResponse.json(
        { error: "No se pudo registrar la cuenta contable." },
        { status: 500 }
      );
    }
  },
});
