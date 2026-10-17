# Implementation Plan: Generación de PLE

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)
**Stack**: Next.js (App Router) + Prisma/PostgreSQL + Vitest. Convención del repo: lógica
pura en `lib/**` con tests `*.test.ts`, acceso a datos en `lib/services/*.service.ts`,
rutas en `app/api/**/route.ts`, UI en `app/accounting/**`. **Todo el código en inglés.**

## Architecture

```
lib/ple/
  constants.ts        book codes, indicators, field separator, encoding
  types.ts            FieldDef, BookDef, PleRecord, PleIssue, PleResult
  format.ts           sanitize text, money (cents), dates, period
  file-name.ts        buildPleFileName()
  serializer.ts       serializeRecords(def, rows) → validates + builds TXT lines
  tables.ts           voucher types, identity doc types, mapping helpers
  books/
    sales-register.ts        14.1 definition + buildSalesRegister()
    purchases-register.ts    8.1  definition + buildPurchasesRegister()
    general-journal.ts       5.1/6.1 definition + builders
    chart-of-accounts.ts     5.3
    cash-book.ts             1.1
  generate.ts         generatePleBook(book, snapshot) → { fileName, content, issues, summary }
  *.test.ts
lib/services/ple.service.ts   Prisma → PleSnapshot (invoices, purchases, entries, accounts)
app/api/ple/[book]/route.ts   GET ?year=&month=&format=preview|txt
app/accounting/ple/page.tsx   UI (year, month, list of books, PLE buttons, issues)
lib/services/ple-client.service.ts  fetch helpers for the page
```

### Data flow

1. `ple.service.loadSnapshot(year, month)` reads (read-only) the month's
   `SalesInvoice`, `PurchaseInvoice`, `JournalEntry (+details, accounts)` and the RUC from
   restaurant config → `PleSnapshot` (plain data, no Prisma types).
2. Pure functions turn the snapshot into **canonical rows** (`SalesRegisterRow`,
   `PurchaseRegisterRow`, `JournalLine`) — reusable by SIRE.
3. `serializer` validates each row against its `BookDef` and emits lines; issues are
   collected; the API returns the TXT only when there are no errors.

### Key mappings (ERP → PLE)

| PLE | ERP source |
|---|---|
| CUO | `JournalEntry.code` sanitized (≤40; `&` and `|` removed) |
| Correlativo `M{n}` | 1-based line index inside the entry (`A`/`C` if entry book flagged opening/closing — future) |
| Voucher type | `Factura→01`, `Boleta→03`, other→`00` |
| Serie / number | `series` (≤4) / `number` zero-padded to 8 |
| Customer doc | `Customer.documentNumber` length 11 → `6` RUC, 8 → `1` DNI, else none |
| 14.1 amounts | `subtotal` → base (14), `igv` → 16, `totalAmount` → 24 |
| 14.1 status | `status === "Issued"` → `1`; annulled → `2` |
| 8.1 amounts | `subtotal`/`igv`/`totalAmount` of `PurchaseInvoice`; `Factura` → 14/15, others → 20 |
| 8.1 status | `1` same month; `6` ≤ 12 months earlier; `7` older; `0` no credit |
| Period | month of the journal entry date (annotation); fallback `issuedAt` |

## Contracts

`GET /api/ple/{book}?year=2026&month=10&mode=preview|download`

- `book` ∈ `sales-register | purchases-register | general-journal | chart-of-accounts | general-ledger | cash-book`
- `mode=preview` → `200 { fileName, recordCount, totals, issues[] }`
- `mode=download` → `200 text/plain; charset=windows-1252` with `Content-Disposition` when `issues` has no errors; otherwise `422 { issues }`.
- `400` invalid year/month/book; `401/403` via `authorize("reportes.ver")`; `409` missing RUC.

## Risks / open items (from research)

1. Book codes 050100/050300/060100/010100 are SECONDARY-source → constants, validate with SUNAT validator.
2. Encoding and CRLF terminator: configurable constants; default Windows-1252 + CRLF.
3. `5.1 field 20` post RS 112-2021 (CAR) not applicable until SIRE integration.
4. Sales numbered correlatively by series: gaps are not detected here (SIRE phase).

## Testing

Vitest unit tests (no DB): file name, sanitizer, money, each book builder (golden lines),
cuadre Debe=Haber, status rules, error collection. Route handler tests with Prisma mocked
following `app/api/daily-book/route.test.ts` style.
