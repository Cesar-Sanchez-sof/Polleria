import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { isPleBookId } from "@/lib/ple/constants";
import { buildCsv } from "@/lib/ple/csv";
import { encodeWindows1252 } from "@/lib/ple/encoding";
import { generatePleBook } from "@/lib/ple/generate";
import { loadPleSnapshot } from "@/lib/services/ple.service";

export const dynamic = "force-dynamic";

/** Maximum rows sent to the on-screen preview (the downloads always contain every row). */
const PREVIEW_ROW_LIMIT = 1000;

/**
 * @openapi
 * /api/ple/{book}:
 *   get:
 *     tags:
 *       - PLE
 *     summary: Generate a SUNAT electronic book (PLE)
 *     description: >-
 *       Generates the TXT of one electronic book for a month following the SUNAT PLE
 *       structures. `mode=preview` returns counts, totals and validation issues;
 *       `mode=download` returns the TXT file when there are no errors (422 otherwise), or a
 *       CSV review copy with `format=csv`.
 *     parameters:
 *       - in: path
 *         name: book
 *         required: true
 *         schema:
 *           type: string
 *           enum: [sales-register, purchases-register, general-journal, chart-of-accounts, general-ledger, cash-book]
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [preview, download]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [txt, csv]
 *     responses:
 *       200:
 *         description: Preview summary or TXT file.
 *       400:
 *         description: Invalid book, year or month.
 *       409:
 *         description: The taxpayer RUC is not configured.
 *       422:
 *         description: The book has validation errors and cannot be downloaded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ book: string }> }
) {
  const auth = await authorize("reportes.ver");
  if (!auth.ok) return auth.response;

  try {
    const { book } = await params;
    if (!isPleBookId(book)) {
      return Response.json({ error: "Unknown electronic book." }, { status: 400 });
    }

    const search = request.nextUrl.searchParams;
    const year = Number(search.get("year"));
    const month = Number(search.get("month"));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return Response.json({ error: "Year must be between 2000 and 2100." }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: "Month must be between 1 and 12." }, { status: 400 });
    }
    const mode = search.get("mode") === "download" ? "download" : "preview";
    const format = search.get("format") === "csv" ? "csv" : "txt";

    const snapshot = await loadPleSnapshot(year, month);
    if (!/^\d{11}$/.test(snapshot.taxpayer.ruc)) {
      return Response.json(
        { error: "Configure an 11-digit RUC in the restaurant data before generating PLE files." },
        { status: 409 }
      );
    }

    const result = generatePleBook(book, snapshot);

    if (mode === "preview") {
      return Response.json({
        book: result.book,
        fileName: result.fileName,
        recordCount: result.recordCount,
        columns: result.columns,
        rows: result.rows.slice(0, PREVIEW_ROW_LIMIT),
        truncated: result.rows.length > PREVIEW_ROW_LIMIT,
        totals: result.totals,
        issues: result.issues,
        hasErrors: result.hasErrors,
      });
    }

    if (format === "csv") {
      // Review copy: allowed even with validation errors so the data can be inspected.
      const csv = "﻿" + buildCsv(result.columns, result.rows);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.fileName.replace(/\.TXT$/, ".csv")}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (result.hasErrors) {
      return Response.json(
        { error: "The book has validation errors.", issues: result.issues },
        { status: 422 }
      );
    }

    return new Response(Buffer.from(encodeWindows1252(result.content)), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=windows-1252",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/ple] failed to generate the electronic book:", error);
    return Response.json({ error: "The electronic book could not be generated." }, { status: 500 });
  }
}
