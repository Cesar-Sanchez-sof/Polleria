"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Card } from "@/components/ui/card";

import { CuentaDialog } from "./components/CuentaDialog";
import { AccountTable, type AccountTableRow } from "./components/AccountTable";
import { ToolbarCuentas } from "./components/ToolbarCuentas";

import {
  updateAccount,
  ErrorApi as ApiError,
  listAccounts,
  type AccountingAccount,
} from "@/lib/services/cuentas.service";

/**
 * Chart of accounts overview and creation page.
 */
export default function CuentasPage() {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => new Set());

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<AccountingAccount | null>(null);
  const [initialParent, setInitialParent] = useState<AccountingAccount | null>(null);

  const [actionAccountId, setActionAccountId] = useState<number | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listAccounts();
      setAccounts(data);
    } catch (err) {
      setAccounts([]);
      setErrorMessage(err instanceof Error ? err.message : "No se pudo cargar el plan contable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAccounts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAccounts]);

  const accountTree = useMemo(() => {
    const accountIds = new Set(accounts.map((c) => c.id));
    const childrenMap = new Map<number, AccountingAccount[]>();
    const roots: AccountingAccount[] = [];
    const compareByCode = (a: AccountingAccount, b: AccountingAccount) =>
      a.codigo.localeCompare(b.codigo);

    for (const account of accounts) {
      if (account.idPadre !== null && accountIds.has(account.idPadre)) {
        const list = childrenMap.get(account.idPadre) ?? [];
        list.push(account);
        childrenMap.set(account.idPadre, list);
      } else {
        roots.push(account);
      }
    }

    roots.sort(compareByCode);
    for (const list of childrenMap.values()) list.sort(compareByCode);
    return { children: childrenMap, roots };
  }, [accounts]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || typeFilter !== "todos" || statusFilter !== "todos";

  const rows = useMemo<AccountTableRow[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchesFilter = (account: AccountingAccount): boolean => {
      if (query && !`${account.codigo} ${account.nombre} ${account.tipo}`.toLowerCase().includes(query)) {
        return false;
      }
      if (typeFilter !== "todos" && account.tipo !== typeFilter) return false;
      if (statusFilter === "activas" && !account.activo) return false;
      if (statusFilter === "inactivas" && account.activo) return false;
      return true;
    };

    const isInBranch = (account: AccountingAccount): boolean =>
      matchesFilter(account) || (accountTree.children.get(account.id) ?? []).some(isInBranch);

    const outputRows: AccountTableRow[] = [];
    const traverse = (list: AccountingAccount[], depth: number) => {
      for (const account of list) {
        if (hasActiveFilters && !isInBranch(account)) continue;
        const children = accountTree.children.get(account.id) ?? [];
        const isCollapsed = !hasActiveFilters && collapsedIds.has(account.id);
        outputRows.push({
          account: account,
          depth: depth,
          hasChildren: children.length > 0,
          expanded: !isCollapsed,
        });
        if (!isCollapsed) traverse(children, depth + 1);
      }
    };

    traverse(accountTree.roots, 0);
    return outputRows;
  }, [accountTree, collapsedIds, statusFilter, hasActiveFilters, searchQuery, typeFilter]);

  const handleToggleBranch = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedIds(new Set());
  const handleCollapseAll = () => setCollapsedIds(new Set(accountTree.children.keys()));

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setInitialParent(null);
    setIsDialogOpen(true);
  };

  const handleCreateSubaccount = (parent: AccountingAccount) => {
    setEditingAccount(null);
    setInitialParent(parent);
    setIsDialogOpen(true);
  };

  const handleEditAccount = (account: AccountingAccount) => {
    setEditingAccount(account);
    setInitialParent(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
    setInitialParent(null);
  };

  const handleSaved = () => {
    handleCloseDialog();
    void loadAccounts();
  };

  const handleToggleStatus = async (account: AccountingAccount) => {
    if (actionAccountId !== null) return;
    setActionAccountId(account.id);
    setNoticeMessage(null);
    try {
      await updateAccount(account.id, { activo: !account.activo });
      await loadAccounts();
    } catch (err) {
      setNoticeMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo cambiar el estado de la cuenta."
      );
    } finally {
      setActionAccountId(null);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("todos");
    setStatusFilter("todos");
  };

  return (
    <>
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        <main className="relative flex-1 p-6">
          <div className="flex flex-col w-full gap-5">
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <ToolbarCuentas
                q={searchQuery}
                onBuscar={setSearchQuery}
                onLimpiarBusqueda={() => setSearchQuery("")}
                tipo={typeFilter}
                onTipo={setTypeFilter}
                estado={statusFilter}
                onEstado={setStatusFilter}
                onNuevo={handleCreateAccount}
                visibles={rows.length}
                total={accounts.length}
                cargando={isLoading}
              />
            </Card>

            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              {noticeMessage && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{noticeMessage}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setNoticeMessage(null)}
                    className="text-amber-500 hover:text-amber-800 cursor-pointer shrink-0"
                    title="Descartar aviso"
                    aria-label="Descartar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <AccountTable
                rows={rows}
                loading={isLoading}
                error={errorMessage}
                hasFilters={hasActiveFilters}
                actionId={actionAccountId}
                onToggleBranch={handleToggleBranch}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onEdit={handleEditAccount}
                onCreateChild={handleCreateSubaccount}
                onToggleStatus={handleToggleStatus}
                onRetry={loadAccounts}
                onClearFilters={handleClearFilters}
              />
            </Card>
          </div>
        </main>
      </div>

      {isDialogOpen && (
        <CuentaDialog
          abierto={isDialogOpen}
          cuenta={editingAccount}
          padreInicial={initialParent}
          cuentas={accounts}
          onCerrar={handleCloseDialog}
          onGuardado={handleSaved}
        />
      )}
    </>
  );
}
