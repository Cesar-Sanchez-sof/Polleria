# Tasks: Generación de archivos PLE (SUNAT)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

## Phase 1 – Research
- [x] T001 Investigar RS 286-2009, 361-2015, 042-2021, 112-2021 y estructuras 14.1, 8.1, 5.1, 5.3, 6.1, 1.1 → `research.md`
- [x] T002 Documentar PLE vs SIRE, nombre de archivo, reglas generales y nivel de confianza por dato

## Phase 2 – Foundation (`lib/ple`)
- [x] T003 `constants.ts`, `types.ts`, `format.ts`, `tables.ts`, `file-name.ts`
- [x] T004 `serializer.ts` con validación por campo y colector de issues
- [x] T005 `snapshot.ts` (contrato de datos) y `journal.ts` (CUO, correlativos `M{n}`, dato estructurado)
- [x] T006 `encoding.ts` (Windows-1252)

## Phase 3 – Books
- [x] T007 [US1] 14.1 `books/sales-register.ts`
- [x] T008 [US1] 8.1 `books/purchases-register.ts`
- [x] T009 [US1][US3] 5.1 / 6.1 `books/general-journal.ts`
- [x] T010 [US1] 5.3 `books/chart-of-accounts.ts`
- [x] T011 [US1] 1.1 `books/cash-book.ts`
- [x] T012 [US2] `generate.ts` orquesta validación, TXT y nombre

## Phase 4 – Integration
- [x] T013 `lib/services/ple.service.ts` (Prisma → snapshot, solo lectura)
- [x] T014 `app/api/ple/[book]/route.ts` (preview/download, `reportes.ver`)
- [x] T015 `lib/services/ple-client.service.ts` y página `app/accounting/ple/page.tsx`
- [x] T016 Menú lateral (REPORTES CONTABLES → Libros SUNAT (PLE)) y permiso de ruta

## Phase 5 – Tests
- [x] T017 `lib/ple/ple.test.ts` (formato, nombres, 14.1, 8.1, 5.1, 6.1, 5.3, 1.1, mes vacío)
- [x] T018 `app/api/ple/[book]/route.test.ts`

## Phase 6 – Pending / next
- [ ] T019 Validar los TXT reales con el **Validador PLE de SUNAT** (códigos 050100/050300/060100/010100, CRLF y codificación)
- [ ] T020 Verificar con datos reales de la BD (mes con ventas/compras) y ajustar mapeos
- [ ] T021 Formato 1.2 (Bancos), 8.2 (no domiciliados) y 3.x/inventarios
- [ ] T022 Notas de crédito/débito (tipos 07/08) cuando el ERP las emita
- [ ] T023 Feature `040-sire-integration`: archivo plano RVIE/RCE y API OAuth2 SUNAT usando `SalesRegisterRow` / `PurchaseRegisterRow`
- [ ] T024 Asientos de apertura/cierre (`A`/`C`) y estados 8/9 (ajustes de periodos anteriores)
