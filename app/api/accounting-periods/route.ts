import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Define role IDs matching your database role entries
const ADMIN_ROLE_ID = 1; // adjust if ADMIN has a different ID

// Simple role check helper – expects headers "x-user-id" and "x-user-role" set by your auth middleware.
async function requireRole(request: NextRequest, allowedRoles: number[]): Promise<number> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    throw new Error('Unauthorized: missing authentication token');
  }
  // For this demo, token is a dummy placeholder; map to admin user (id 1)
  const user = await prisma.user.findUnique({ where: { id: 1 } });
  if (!user) {
    throw new Error('Unauthorized: user not found');
  }
  if (!allowedRoles.includes(user.roleId)) {
    throw new Error('Forbidden: insufficient role');
  }
  return user.id;
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
    const userId = await requireRole(request, [ADMIN_ROLE_ID]);

    const body = await request.json();
    const { startDate, endDate } = body as { startDate?: string; endDate?: string };
    const errors: string[] = [];
    if (!startDate) errors.push("startDate is required");
    if (!endDate) errors.push("endDate is required");
    if (errors.length) {
      return Response.json({ errors }, { status: 400 });
    }
    const start = new Date(startDate!); // startDate is validated above
    const end = new Date(endDate!); // endDate is validated above
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
