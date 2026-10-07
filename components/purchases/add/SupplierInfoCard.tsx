"use client";

import React from "react";
import { FileText, MapPin, User, Phone, Mail } from "lucide-react";

interface SupplierInfoCardProps {
  supplier: {
    id: number;
    ruc: string;
    businessName: string;
    contactPerson?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

export function SupplierInfoCard({ supplier }: SupplierInfoCardProps) {
  if (!supplier) return null;

  return (
    <div className="bg-muted/50 border rounded-lg p-3 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="rounded-full bg-blue-100 p-1.5 shrink-0 text-blue-700">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground block">RUC / Documento</span>
          <span className="font-mono font-semibold text-xs text-foreground">{supplier.ruc}</span>
        </div>
      </div>

      {supplier.contactPerson && (
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-emerald-100 p-1.5 shrink-0 text-emerald-700">
            <User className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Persona de Contacto</span>
            <span className="font-medium text-xs text-foreground">{supplier.contactPerson}</span>
          </div>
        </div>
      )}

      {supplier.address && (
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-amber-100 p-1.5 shrink-0 text-amber-700">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Dirección</span>
            <span className="font-medium text-xs text-foreground">{supplier.address}</span>
          </div>
        </div>
      )}

      {(supplier.phone || supplier.email) && (
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-purple-100 p-1.5 shrink-0 text-purple-700">
            {supplier.phone ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Contacto Directo</span>
            <span className="font-medium text-xs text-foreground">
              {[supplier.phone && `Tel: ${supplier.phone}`, supplier.email].filter(Boolean).join(" • ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
