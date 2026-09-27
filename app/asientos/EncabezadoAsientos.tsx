"use client";

import { Bell, HelpCircle, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Texto del buscador global (mismo estado que filtra el listado). */
  q: string;
  onBuscar: (valor: string) => void;
}

/** Cabecera fija de la pantalla de asientos contables. */
export function EncabezadoAsientos({ q, onBuscar }: Readonly<Props>) {
  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-xl z-40 flex items-center justify-between px-6 shadow-xs ">
      <div className="flex items-center gap-3 w-96">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-full text-xs text-slate-900 outline-none -none shadow-none focus-visible:ring-2 focus-visible:ring-red-600 h-8"
            placeholder="Buscar cuentas, transacciones o boletas..."
            type="text"
            value={q}
            onChange={(e) => onBuscar(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all cursor-pointer h-9 w-9"
          type="button"
          title="Notificaciones"
        >
          <Bell className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all cursor-pointer h-9 w-9"
          type="button"
          title="Ayuda"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center cursor-pointer text-white">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
