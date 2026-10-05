import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Simple role check helper – expects headers "x-user-id" and "x-user-role" set by your auth middleware.
function requireRole(request: NextRequest, allowedRoles: string[]): number {
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");
  if (!userId || !userRole) {
    throw new Error("Unauthorized: missing authentication headers");
  }
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Forbidden: insufficient role");
  }
  return Number(userId);
}

/**
 * GET /api/accounting-periods
 * Returns a list of accounting periods. Accepts optional query parameters:
 *   ?status=open|closed – filter by status
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const where: Prisma.AccountingPeriodWhereInput = {};
    if (status) {
      if (status === "open") where.status = "OPEN";
      else if (status === "closed") where.status = "CLOSED";
    }
    const periods = await prisma.accountingPeriod.findMany({ where });
    return Response.json(periods);
  } catch (error) {
    console.error("[api/accounting-periods] GET error:", error);
    return Response.json({ error: "Error retrieving periods" }, { status: 500 });
  }
}

/**
 * POST /api/accounting-periods
 * Creates a new accounting period. Body expects:
 *   { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 * Only users with role "ADMIN" (or any role you configure) may create periods.
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization – only ADMIN can create periods
    requireRole(request, ["ADMIN"]);

    const body = await request.json();
    const { startDate, endDate } = body as { startDate?: string; endDate?: string };
    const errors: string[] = [];
    if (!startDate) errors.push("startDate is required");
    if (!endDate) errors.push("endDate is required");
    if (errors.length) {
      return Response.json({ errors }, { status: 400 });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime())) errors.push("Invalid startDate");
    if (isNaN(end.getTime())) errors.push("Invalid endDate");
    if (start >= end) errors.push("startDate must be before endDate");
    if (errors.length) {
      return Response.json({ errors }, { status: 400 });
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        startDate: start,
        endDate: end,
        status: "OPEN",
      },
    });
    return Response.json(period, { status: 201 });
  } catch (error) {
    console.error("[api/accounting-periods] POST error:", error);
    const msg = error instanceof Error ? error.message : "Error creating period";
    return Response.json({ error: msg }, { status: 500 });
  }
}
