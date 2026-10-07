"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountingAccount } from "@/lib/services/accounts.service";

/** Tree row representing an account with depth and branch expansion state. */
export interface AccountTableRow {
  account: AccountingAccount;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

interface AccountTableProps {
  rows: AccountTableRow[];
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  actionId: number | null;
  onToggleBranch: (id: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onEdit: (account: AccountingAccount) => void;
  onCreateChild: (account: AccountingAccount) => void;
  onToggleStatus: (account: AccountingAccount) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

const TOTAL_COLUMNS = 6;

export function AccountTable({
  rows,
  loading,
  error,
  hasFilters,
  actionId,
  onToggleBranch,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onCreateChild,
  onToggleStatus,
  onRetry,
  onClearFilters,
}: Readonly<AccountTableProps>) {
  const isSkeleton = loading && rows.length === 0 && !error;
  const isEmpty = !error && !loading && rows.length === 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-3 pb-2 text-[11px] font-semibold text-slate-500">
        <button
          type="button"
          onClick={onExpandAll}
          className="uppercase tracking-wider hover:text-slate-900 cursor-pointer transition-colors"
        >
          Expandir todo
        </button>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <button
          type="button"
          onClick={onCollapseAll}
          className="uppercase tracking-wider hover:text-slate-900 cursor-pointer transition-colors"
        >
          Contraer todo
        </button>
      </div>

      <div
        className={`w-full overflow-x-auto rounded-lg transition-opacity ${loading && rows.length > 0 ? "opacity-60" : ""}`}
      >
        <Table className="w-full text-left border-collapse min-w-30">
          <TableHeader>
            <TableRow className="text-slate-900 text-xs font-semibold bg-slate-50/75 dark:bg-slate-800/75 hover:bg-slate-50/75">
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-24">
                Código
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                Nombre de la cuenta
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-32">
                Tipo
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-28 text-center">
                Estado
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-24 text-right">
                Líneas
              </TableHead>
              <TableHead className="py-3 px-3 w-32 text-right text-slate-500">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
            {isSkeleton &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}

            {error && !loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={TOTAL_COLUMNS} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <p className="text-sm font-semibold">{error}</p>
                    <Button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reintentar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isEmpty && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={TOTAL_COLUMNS} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Inbox className="w-8 h-8 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">
                      {hasFilters
                        ? "No se encontraron cuentas con los filtros seleccionados"
                        : "Sin cuentas contables"}
                    </p>
                    <p className="text-xs">
                      {hasFilters
                        ? "Ajusta la búsqueda, el tipo o el estado."
                        : "Registra la primera cuenta con el botón “Nueva cuenta”."}
                    </p>
                    {hasFilters && (
                      <Button
                        type="button"
                        onClick={onClearFilters}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!error &&
              rows.map(({ account, depth, hasChildren, expanded }) => {
                const inAction = actionId === account.id;
                return (
                  <TableRow
                    key={account.id}
                    className="hover:bg-(--color-background) transition-colors group border-b border-slate-100"
                  >
                    <TableCell className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      {account.codigo}
                    </TableCell>

                    <TableCell className="py-2.5 px-3">
                      <span
                        className="flex items-center gap-1"
                        style={{ marginLeft: depth * 18 }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => onToggleBranch(account.id)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                            title={expanded ? "Contraer subcuentas" : "Expandir subcuentas"}
                            aria-label={
                              expanded
                                ? `Contraer las subcuentas de ${account.nombre}`
                                : `Expandir las subcuentas de ${account.nombre}`
                            }
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                        <span
                          className={
                            depth === 0
                              ? "font-semibold text-slate-900"
                              : "text-slate-700"
                          }
                        >
                          {account.nombre}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-slate-600 text-xs font-medium">
                      {account.tipo}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-center">
                      <Badge
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none ${account.activo ? "bg-emerald-100/80 text-emerald-700" : "bg-slate-200/80 text-slate-600"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${account.activo ? "bg-emerald-600" : "bg-slate-500"}`}
                        ></span>
                        {account.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className="py-2.5 px-3 text-right tabular-nums text-xs text-slate-500"
                      title={
                        account.usos > 0
                          ? `Usada en ${account.usos} línea${account.usos === 1 ? "" : "s"} de asiento`
                          : "Todavía no se usa en ningún asiento"
                      }
                    >
                      {account.usos}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={`Añadir subcuenta a ${account.codigo}`}
                          aria-label={`Añadir subcuenta a ${account.nombre}`}
                          onClick={() => onCreateChild(account)}
                          disabled={inAction}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                        >
                          <FolderPlus className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={`Editar ${account.codigo}`}
                          aria-label={`Editar la cuenta ${account.nombre}`}
                          onClick={() => onEdit(account)}
                          disabled={inAction}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={account.activo ? `Desactivar ${account.codigo}` : `Activar ${account.codigo}`}
                          aria-label={
                            account.activo
                              ? `Desactivar la cuenta ${account.nombre}`
                              : `Activar la cuenta ${account.nombre}`
                          }
                          onClick={() => onToggleStatus(account)}
                          disabled={inAction}
                          className={`p-1.5 rounded group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer h-7 w-7 ${account.activo ? "text-slate-400 hover:text-rose-600" : "text-slate-400 hover:emerald-600"}`}
                        >
                          {inAction ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
