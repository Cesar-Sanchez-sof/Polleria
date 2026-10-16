"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2, Check } from "lucide-react";
import { searchProducts } from "@/lib/services/purchases/product";
import { AffectationIgv } from "@prisma/client";

export interface ProductItem {
  id: number;
  name: string;
  unitOfMeasure: string;
  affectationIgv?: AffectationIgv | null;
  lastCost?: number | string | null;
  currentStock?: number | string;
  active?: boolean;
}

interface ProductSearchSelectProps {
  selectedProductId: number | "";
  onSelectProduct: (product: ProductItem) => void;
  onRequestCreateProduct: (suggestedName: string) => void;
  initialProductsList?: ProductItem[];
}

export function ProductSearchSelect({
  selectedProductId,
  onSelectProduct,
  onRequestCreateProduct,
  initialProductsList = [],
}: ProductSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverResults, setServerResults] = useState<ProductItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize query with selectedProductId when dropdown is closed
  const selectedProduct = useMemo(() => {
    return initialProductsList.find((s) => s.id === Number(selectedProductId)) || null;
  }, [selectedProductId, initialProductsList]);

  useEffect(() => {
    if (!isOpen) {
      if (selectedProduct) {
        setQuery(`${selectedProduct.name} (${selectedProduct.unitOfMeasure})`);
      } else if (!selectedProductId) {
        setQuery("");
      }
    }
  }, [selectedProduct, selectedProductId, isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedProduct) {
          setQuery(`${selectedProduct.name} (${selectedProduct.unitOfMeasure})`);
        } else if (!selectedProductId) {
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct, selectedProductId]);

  const cleanQuery = query.trim().toLowerCase();

  // Instant local filtering against all available products
  const localFiltered = useMemo(() => {
    if (!cleanQuery) {
      return initialProductsList.filter((s) => s.active !== false).slice(0, 10);
    }
    return initialProductsList
      .filter((s) => {
        if (s.active === false) return false;
        const nameMatch = s.name.toLowerCase().includes(cleanQuery);
        const combinedMatch = `${s.name} (${s.unitOfMeasure})`.toLowerCase().includes(cleanQuery);
        return nameMatch || combinedMatch;
      })
      .slice(0, 10);
  }, [cleanQuery, initialProductsList]);

  // Server debounced search
  useEffect(() => {
    if (!isOpen || !cleanQuery) {
      setServerResults([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchProducts(cleanQuery, 10);
        if (isMounted && res) {
          const formatted: ProductItem[] = res.map((item) => ({
            id: item.id,
            name: item.name,
            unitOfMeasure: item.unitOfMeasure,
            affectationIgv: item.affectationIgv,
            lastCost: item.lastCost ? Number(item.lastCost) : 0,
            currentStock: item.currentStock ? Number(item.currentStock) : 0,
          }));
          setServerResults(formatted);
        }
      } catch (err) {
        // Fallback to local
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [cleanQuery, isOpen]);

  // Merge results without duplicates
  const displayedResults = useMemo(() => {
    if (!cleanQuery) return localFiltered;

    const map = new Map<number, ProductItem>();
    localFiltered.forEach((item) => map.set(item.id, item));
    serverResults.forEach((item) => map.set(item.id, item));
    return Array.from(map.values()).slice(0, 10);
  }, [cleanQuery, localFiltered, serverResults]);

  const handleSelect = (product: ProductItem) => {
    setQuery(`${product.name} (${product.unitOfMeasure})`);
    onSelectProduct(product);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const nameToPass = query.trim();
    setIsOpen(false);
    onRequestCreateProduct(nameToPass);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Buscar insumo por nombre..."
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
          className="pl-9 h-9 text-xs bg-background"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[9999] left-0 top-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-2xl space-y-0.5 min-w-[280px] w-full">
          {displayedResults.length > 0 ? (
            displayedResults.map((item) => {
              const isSelected = item.id === Number(selectedProductId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-accent/70 font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <span>
                      {item.name} <span className="text-muted-foreground">({item.unitOfMeasure})</span>
                    </span>
                  </div>
                  {item.affectationIgv && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {item.affectationIgv === AffectationIgv.Included ? "Incluido" : "Excluido"}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">
              No se encontraron insumos coincidentes
            </div>
          )}

          {query.trim() !== "" && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateNew();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary font-medium rounded-sm hover:bg-accent text-left border-t mt-1 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">Crear &quot;{query.trim()}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
