"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Banknote, Coins } from "lucide-react";
import {
  type CashDenominations,
  calculateDenominationsTotal,
} from "@/lib/services/cash-register.service";

interface DenominationsCounterProps {
  value: CashDenominations;
  onChange: (value: CashDenominations, total: number) => void;
  compact?: boolean;
}

export function DenominationsCounter({
  value,
  onChange,
  compact = false,
}: DenominationsCounterProps) {
  const updateBill = (key: keyof CashDenominations["bills"], qtyStr: string) => {
    const count = Math.max(0, parseInt(qtyStr, 10) || 0);
    const updated: CashDenominations = {
      ...value,
      bills: {
        ...value.bills,
        [key]: count,
      },
    };
    onChange(updated, calculateDenominationsTotal(updated));
  };

  const updateCoin = (key: keyof CashDenominations["coins"], qtyStr: string) => {
    const count = Math.max(0, parseInt(qtyStr, 10) || 0);
    const updated: CashDenominations = {
      ...value,
      coins: {
        ...value.coins,
        [key]: count,
      },
    };
    onChange(updated, calculateDenominationsTotal(updated));
  };

  const billsTotal =
    (value.bills.b200 || 0) * 200 +
    (value.bills.b100 || 0) * 100 +
    (value.bills.b50 || 0) * 50 +
    (value.bills.b20 || 0) * 20 +
    (value.bills.b10 || 0) * 10;

  const coinsTotal =
    (value.coins.c5 || 0) * 5 +
    (value.coins.c2 || 0) * 2 +
    (value.coins.c1 || 0) * 1 +
    (value.coins.c05 || 0) * 0.5 +
    (value.coins.c02 || 0) * 0.2 +
    (value.coins.c01 || 0) * 0.1;

  const grandTotal = Math.round((billsTotal + coinsTotal) * 100) / 100;

  const billsConfig: Array<{ key: keyof CashDenominations["bills"]; label: string; val: number }> = [
    { key: "b200", label: "S/ 200", val: 200 },
    { key: "b100", label: "S/ 100", val: 100 },
    { key: "b50", label: "S/ 50", val: 50 },
    { key: "b20", label: "S/ 20", val: 20 },
    { key: "b10", label: "S/ 10", val: 10 },
  ];

  const coinsConfig: Array<{ key: keyof CashDenominations["coins"]; label: string; val: number }> = [
    { key: "c5", label: "S/ 5.00", val: 5 },
    { key: "c2", label: "S/ 2.00", val: 2 },
    { key: "c1", label: "S/ 1.00", val: 1 },
    { key: "c05", label: "S/ 0.50", val: 0.5 },
    { key: "c02", label: "S/ 0.20", val: 0.2 },
    { key: "c01", label: "S/ 0.10", val: 0.1 },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-slate-50/80 border border-slate-200 p-3 sm:p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Columna Billetes */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Billetes en Soles</span>
            </span>
            <span className="text-[11px] font-black text-emerald-700">
              S/ {billsTotal.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5">
            {billsConfig.map(({ key, label, val }) => {
              const count = value.bills[key] || 0;
              const subtotal = count * val;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all text-xs"
                >
                  <div className="w-16">
                    <Badge
                      variant="outline"
                      className="font-black text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200 w-full justify-center"
                    >
                      {label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400 font-bold">Cant:</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={count === 0 ? "" : count}
                      onChange={(e) => updateBill(key, e.target.value)}
                      placeholder="0"
                      className="w-16 h-7 text-xs text-center font-bold bg-slate-50 border-slate-200 focus:bg-white rounded-lg p-1"
                    />
                  </div>

                  <span className="w-18 text-right font-extrabold text-slate-800 text-[11px]">
                    S/ {subtotal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Monedas */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Monedas y Céntimos</span>
            </span>
            <span className="text-[11px] font-black text-amber-700">
              S/ {coinsTotal.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5">
            {coinsConfig.map(({ key, label, val }) => {
              const count = value.coins[key] || 0;
              const subtotal = count * val;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all text-xs"
                >
                  <div className="w-16">
                    <Badge
                      variant="outline"
                      className="font-black text-[11px] bg-amber-50 text-amber-900 border-amber-200 w-full justify-center"
                    >
                      {label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400 font-bold">Cant:</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={count === 0 ? "" : count}
                      onChange={(e) => updateCoin(key, e.target.value)}
                      placeholder="0"
                      className="w-16 h-7 text-xs text-center font-bold bg-slate-50 border-slate-200 focus:bg-white rounded-lg p-1"
                    />
                  </div>

                  <span className="w-18 text-right font-extrabold text-slate-800 text-[11px]">
                    S/ {subtotal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Barra de Resumen Total */}
      <div className="mt-1 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <span>
            Billetes: <strong className="text-slate-700">S/ {billsTotal.toFixed(2)}</strong>
          </span>
          <span>•</span>
          <span>
            Monedas: <strong className="text-slate-700">S/ {coinsTotal.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-600">Total Arqueado:</span>
          <span className="text-base font-black text-red-700">
            S/ {grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
