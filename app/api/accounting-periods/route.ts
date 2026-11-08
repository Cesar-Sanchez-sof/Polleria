import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import { PeriodClosingError } from "@/lib/accounting/closing";
import {
  listAccountingPeriodsService,
  createAccountingPeriodService,
  patchAccountingPeriodService,
} from "@/lib/services/accounting-periods.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting-periods
 */
export const GET = createApiHandler({
  permission: "periodos.ver",
  handler: async ({ searchParams }) => {
    const status = searchParams.get("status");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const periods = await listAccountingPeriodsService({
      status,
      month: monthParam,
      year: yearParam,
    });
    return NextResponse.json(periods);
  },
});

/**
 * POST /api/accounting-periods
 */
export const POST = createApiHandler({
  permission: "periodos.crear",
  handler: async ({ req, session, body }) => {
    try {
      const data = (body !== undefined ? body : await req.json().catch(() => ({}))) as {
        month?: number;
        year?: number;
      };
      const period = await createAccountingPeriodService(
        data,
        { userId: session!.userId, username: session!.username },
        requestIp(req) ?? undefined
      );
      return NextResponse.json(period, { status: 201 });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "rawErrors" in err) {
        return NextResponse.json(
          { errors: (err as { rawErrors: string[] }).rawErrors },
          { status: 400 }
        );
      }
      throw err;
    }
  },
});

/**
 * PATCH /api/accounting-periods
 */
export const PATCH = createApiHandler({
  permission: "periodos.editar",
  handler: async ({ req, session, body }) => {
    try {
      const data = (body !== undefined ? body : await req.json().catch(() => ({}))) as {
        periodId?: number;
        reopen?: boolean;
      };
      const updated = await patchAccountingPeriodService(
        data,
        { userId: session!.userId, username: session!.username },
        requestIp(req) ?? undefined
      );
      return NextResponse.json(updated);
    } catch (err: unknown) {
      if (err instanceof PeriodClosingError) {
        return NextResponse.json(
          { error: err.message, issues: err.issues },
          { status: 409 }
        );
      }
      throw err;
    }
  },
});
