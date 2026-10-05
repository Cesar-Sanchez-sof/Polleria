"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

import { JournalEntryDetail } from "./components/JournalEntryDetail";
import { JournalEntryFilters, type FilterChip } from "./components/JournalEntryFilters";
import { NewJournalEntryDialog } from "./components/NewJournalEntryDialog";
import { JournalEntryPagination } from "./components/JournalEntryPagination";
import { JournalEntryTabs } from "./components/JournalEntryTabs";
import { JournalEntryTable } from "./components/JournalEntryTable";
import { JournalEntryToolbar } from "./components/JournalEntryToolbar";

import {
  listJournalEntries,
  getJournalEntry,
  getJournalEntriesOptions,
  type JournalEntryDetail as TypeJournalEntryDetail,
  type SortDirection,
  type JournalEntriesOptions,
  type JournalEntriesPage,
  type JournalEntrySort,
} from "@/lib/services/journal-entries.service";

/**
 * Journal entries consultation screen.
 * Presentation logic lives in ./<Component>Asientos.tsx and data access
 * in lib/services/asientos.service.ts.
 */
export default function AsientosPage() {
  // ---------------------------------------------------------------------
  // Filters (all applied simultaneously)
  // ---------------------------------------------------------------------
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [journal, setJournal] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Order and pagination
  const [order, setOrder] = useState<{ field: JournalEntrySort; dir: SortDirection }>({
    field: "fecha",
    dir: "desc",
  });
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Data
  const [pageData, setPageData] = useState<JournalEntriesPage | null>(null);
  const [options, setOptions] = useState<JournalEntriesOptions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected entry detail
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TypeJournalEntryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Manual entry modal
  const [newOpen, setNewOpen] = useState<boolean>(false);

  // Race condition protection: only the latest request updates state
  const requestRef = useRef(0);
  const detailRequestRef = useRef(0);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchQuery ? prev : searchQuery));
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Options (journals and statuses)
  useEffect(() => {
    let active = true;
    getJournalEntriesOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        if (active) setOptions(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const reloadOptions = useCallback(() => {
    getJournalEntriesOptions()
      .then((data) => setOptions(data))
      .catch(() => setOptions(null));
  }, []);

  // Listing query
  const loadEntries = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await listJournalEntries({
        desde: from,
        hasta: to,
        diario: journal === "todos" ? "" : journal,
        estado: statusFilter === "todos" ? "" : statusFilter,
        q: search,
        page,
        pageSize,
        orden: order.field,
        dir: order.dir,
      });
      if (requestId !== requestRef.current) return;
      setPageData(data);
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setPageData(null);
      setErrorMessage(e instanceof Error ? e.message : "No se pudo cargar el listado de asientos.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [from, to, journal, statusFilter, search, page, pageSize, order]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEntries();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  const hasFilters =
    Boolean(from) ||
    Boolean(to) ||
    journal !== "todos" ||
    statusFilter !== "todos" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setJournal("todos");
    setStatusFilter("todos");
    setSearchQuery("");
    setSearch("");
    setPage(1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearch("");
    setPage(1);
  };

  const changeJournal = (val: string) => {
    setJournal(val);
    setPage(1);
  };

  const changeStatus = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const changeRange = (field: "from" | "to", val: string) => {
    if (field === "from") setFrom(val);
    else setTo(val);
    setPage(1);
  };

  const removeFilter = (chip: FilterChip) => {
    switch (chip) {
      case "from":
        changeRange("from", "");
        break;
      case "to":
        changeRange("to", "");
        break;
      case "journal":
        changeJournal("todos");
        break;
      case "status":
        changeStatus("todos");
        break;
      case "q":
        clearSearch();
        break;
    }
  };

  const sortBy = (field: JournalEntrySort) => {
    setOrder((prev) => {
      if (prev.field === field) {
        return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      const defaultDir: SortDirection =
        field === "fecha" || field === "total" ? "desc" : "asc";
      return { field, dir: defaultDir };
    });
    setPage(1);
  };

  const changePageSize = (val: number) => {
    setPageSize(val);
    setPage(1);
  };

  const changePage = (val: number) => setPage(val);

  const handleCreatedEntry = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      void loadEntries();
    }
    reloadOptions();
  };

  const openDetail = async (id: number) => {
    const requestId = ++detailRequestRef.current;
    setDetailOpen(true);
    setDetailId(id);
    setDetail(null);
    setErrorDetail(null);
    setLoadingDetail(true);
    try {
      const data = await getJournalEntry(id);
      if (requestId !== detailRequestRef.current) return;
      setDetail(data);
    } catch (e) {
      if (requestId !== detailRequestRef.current) return;
      setErrorDetail(e instanceof Error ? e.message : "No se pudo cargar el detalle del asiento.");
    } finally {
      if (requestId === detailRequestRef.current) setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
    setDetail(null);
    setErrorDetail(null);
  };

  const retryDetail = () => {
    if (detailId !== null) void openDetail(detailId);
  };

  const handleSelectAll = (checked: boolean) => {
    const visibleIds = (pageData?.data ?? []).map((r) => r.id);
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------
  const rows = pageData?.data ?? [];
  const meta = pageData?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPaginas ?? 1;

  const fromShown = total === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1;
  const toShown = total === 0 ? 0 : Math.min(fromShown + rows.length - 1, total);

  const journals = options?.diarios ?? [];

  return (
    <>
      {/* Main content area */}
      <ModuleHeader
        title="Asientos / Libro Diario"
        subtitle="Registro y consulta de asientos del periodo"
        icon={Calculator}
        iconClassName="bg-red-100 text-red-700"
      />
      {/* Main Content */}
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          {/* MAIN LEDGER APPLICATION CARD */}
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
            <JournalEntryToolbar
              q={searchQuery}
              onSearch={setSearchQuery}
              onClearSearch={clearSearch}
              onNew={() => setNewOpen(true)}
              fromShown={fromShown}
              toShown={toShown}
              total={total}
              loading={loading}
              page={page}
              totalPages={totalPages}
              onPage={changePage}
            />
          </Card>
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <JournalEntryTabs
                journals={journals}
                total={total}
                journal={journal}
                onSelect={changeJournal}
              />

              <JournalEntryFilters
                from={from}
                to={to}
                journal={journal}
                statusFilter={statusFilter}
                search={search}
                options={options}
                hasFilters={hasFilters}
                onFrom={(val) => changeRange("from", val)}
                onTo={(val) => changeRange("to", val)}
                onStatus={changeStatus}
                onClear={clearFilters}
                onRemove={removeFilter}
              />
            </div>

            <JournalEntryTable
              rows={rows}
              loading={loading}
              error={errorMessage}
              hasFilters={hasFilters}
              order={order}
              pageSize={pageSize}
              selectedIds={selectedIds}
              onSort={sortBy}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              onOpenDetail={openDetail}
              onRetry={() => void loadEntries()}
              onClearFilters={clearFilters}
            />

            <JournalEntryPagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              loading={loading}
              fromShown={fromShown}
              toShown={toShown}
              total={total}
              selectedCount={selectedIds.length}
              onPage={changePage}
              onPageSize={changePageSize}
            />
          </Card>
        </div>
      </main>

      {/* DETALLE DEL ASIENTO SELECCIONADO */}
      <JournalEntryDetail
        open={detailOpen}
        detail={detail}
        loading={loadingDetail}
        error={errorDetail}
        onClose={closeDetail}
        onRetry={retryDetail}
      />

      {/* ALTA MANUAL DE UN ASIENTO */}
      <NewJournalEntryDialog
        open={newOpen}
        journals={options?.diarios ?? []}
        onClose={() => setNewOpen(false)}
        onCreated={handleCreatedEntry}
      />
    </>
  );
}
