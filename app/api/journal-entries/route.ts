import { NextResponse } from "next/server";
import { createApiHandler, DomainError } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/security/audit.service";
import {
  listJournalEntriesDomain,
  createJournalEntryDomain,
  JournalEntryValidationError,
} from "@/lib/services/accounting/journal-entries-domain.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal-entries
 * Obtiene una lista paginada de asientos con filtros de fecha, diario, estado y búsqueda.
 */
export const GET = createApiHandler({
  permission: "asientos.ver",
  handler: async ({ searchParams }) => {
    try {
      const result = await listJournalEntriesDomain(searchParams);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error("[api/journal-entries] error al listar asientos:", error);
      return NextResponse.json(
        { error: "No se pudo obtener el listado de asientos contables." },
        { status: 500 }
      );
    }
  },
});

/**
 * POST /api/journal-entries
 * Registrar un nuevo asiento contable manual.
 */
export const POST = createApiHandler({
  permission: "asientos.crear",
  handler: async ({ req, body }) => {
    try {
      const rawBody = body !== undefined ? body : await req.json().catch(() => null);
      const result = await createJournalEntryDomain(rawBody, requestIp(req) ?? undefined);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof JournalEntryValidationError) {
        return NextResponse.json(
          { error: error.message, errors: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof DomainError) throw error;
      if (error instanceof Error && error.message === "No se pudo asignar un número de asiento, intente nuevamente.") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.error("[api/journal-entries] error al registrar el asiento:", error);
      return NextResponse.json(
        { error: "No se pudo registrar el asiento contable." },
        { status: 500 }
      );
    }
  },
});
