"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus, Check, Building2 } from "lucide-react";

export interface SupplierItem {
  id: number;
  ruc: string;
  businessName: string;
  contactPerson?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
}

interface SupplierSearchSelectProps {
  selectedSupplierId: number | "";
  onSelectSupplier: (supplier: SupplierItem) => void;
  onRequestCreateSupplier: (suggestedQuery: string) => void;
  initialSuppliersList?: SupplierItem[];
}

export function SupplierSearchSelect({
  selectedSupplierId,
  onSelectSupplier,
  onRequestCreateSupplier,
  initialSuppliersList = [],
}: SupplierSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize query display when closed
  const selectedSupplier = useMemo(() => {
    return initialSuppliersList.find((s) => s.id === Number(selectedSupplierId)) || null;
  }, [selectedSupplierId, initialSuppliersList]);

  useEffect(() => {
    if (!isOpen) {
      if (selectedSupplier) {
        setQuery(`${selectedSupplier.businessName} (${selectedSupplier.ruc})`);
      } else if (!selectedSupplierId) {
        setQuery("");
      }
    }
  }, [selectedSupplier, selectedSupplierId, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedSupplier) {
          setQuery(`${selectedSupplier.businessName} (${selectedSupplier.ruc})`);
        } else if (!selectedSupplierId) {
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSupplier, selectedSupplierId]);

  const cleanQuery = query.trim().toLowerCase();

  // Instant local filtering by RUC, DNI or Business Name
  const displayedResults = useMemo(() => {
    const activeList = initialSuppliersList.filter((s) => s.active !== false);
    if (!cleanQuery) {
      return activeList.slice(0, 10);
    }
    return activeList
      .filter((s) => {
        const rucMatch = s.ruc.toLowerCase().includes(cleanQuery);
        const nameMatch = s.businessName.toLowerCase().includes(cleanQuery);
        const contactMatch = s.contactPerson?.toLowerCase().includes(cleanQuery);
        return rucMatch || nameMatch || contactMatch;
      })
      .slice(0, 10);
  }, [cleanQuery, initialSuppliersList]);

  const handleSelect = (supplier: SupplierItem) => {
    setQuery(`${supplier.businessName} (${supplier.ruc})`);
    onSelectSupplier(supplier);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const textToPass = query.trim();
    setIsOpen(false);
    onRequestCreateSupplier(textToPass);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Escribir RUC, DNI o Razón Social del proveedor..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onClick={() => {
            if (!isOpen) setIsOpen(true);
          }}
          className="pl-9 pr-4 h-10 text-xs bg-background font-medium focus-visible:ring-blue-500/20"
        />
      </div>

      {isOpen && (
        <div className="absolute z-[9999] left-0 top-full mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-2xl space-y-1 min-w-[320px] w-full">
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
            Proveedores disponibles ({displayedResults.length})
          </div>

          {displayedResults.length > 0 ? (
            displayedResults.map((item) => {
              const isSelected = item.id === Number(selectedSupplierId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-accent hover:text-accent-foreground text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-accent/80 font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-semibold text-foreground block truncate">
                        {item.businessName}
                      </span>
                      {item.contactPerson && (
                        <span className="text-[11px] text-muted-foreground block truncate">
                          Contacto: {item.contactPerson}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] bg-muted/70 px-2 py-0.5 rounded text-foreground shrink-0 ml-2">
                    {item.ruc.length === 8 ? "DNI: " : "RUC: "}
                    {item.ruc}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No se encontró ningún proveedor con &quot;{query.trim()}&quot;
            </div>
          )}

          {query.trim() !== "" && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateNew();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-blue-600 font-semibold rounded-md hover:bg-blue-50 text-left border-t mt-1 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="truncate">Registrar nuevo proveedor &quot;{query.trim()}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
