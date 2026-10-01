"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewVoucherDialog } from "./NewVoucherDialog";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import { Search, Plus, CreditCard, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface Voucher {
  id: number;
  voucherType: string;
  series: string;
  number: number;
  issuedAt: Date | string;
  subtotal: number | string;
  igv: number | string;
  totalAmount: number | string;
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: "Pendiente" | "Parcial" | "Pagado";
  supplier: {
    id: number;
    businessName: string;
    ruc: string;
  };
  receipt: {
    id: number;
  };
  payments: Array<{
    id: number;
    amount: number | string;
    paidAt: Date | string;
    paymentType: {
      name: string;
    };
  }>;
}

interface PaymentType {
  id: number;
  name: string;
}

interface VouchersTableProps {
  initialVouchers: Voucher[];
  receiptsWithoutVoucher: any[];
  paymentTypes: PaymentType[];
}

export function VouchersTable({
  initialVouchers,
  receiptsWithoutVoucher,
  paymentTypes,
}: VouchersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [voucherToPay, setVoucherToPay] = useState<Voucher | null>(null);

  const filtered = initialVouchers.filter((c) => {
    const q = search.toLowerCase();
    const voucherLabel = `${c.voucherType} ${c.series}-${c.number}`.toLowerCase();
    return (
      voucherLabel.includes(q) ||
      c.supplier.businessName.toLowerCase().includes(q) ||
      c.supplier.ruc.includes(q)
    );
  });

  const handleOpenPayment = (comp: Voucher) => {
    setVoucherToPay(comp);
    setPaymentDialogOpen(true);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por comprobante, RUC o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Registrar Factura / Comprobante
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado Pago</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  No hay comprobantes de compra registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const date = new Date(c.issuedAt).toLocaleDateString("es-PE");
                const totalNum = Number(c.totalAmount);

                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">
                      {c.voucherType} {c.series}-{c.number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{c.supplier.businessName}</span>
                        <span className="block text-xs font-mono text-muted-foreground">
                          RUC: {c.supplier.ruc}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{date}</TableCell>
                    <TableCell className="text-right font-semibold">
                      S/ {totalNum.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      S/ {c.totalPagado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {c.saldoPendiente.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {c.estadoPago === "Pagado" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Pagado
                        </span>
                      )}
                      {c.estadoPago === "Parcial" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> Parcial
                        </span>
                      )}
                      {c.estadoPago === "Pendiente" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.estadoPago !== "Pagado" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPayment(c)}
                          className="flex items-center gap-1.5 ml-auto text-xs"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pagar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Completo</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <NewVoucherDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        receiptsWithoutVoucher={receiptsWithoutVoucher}
        paymentTypes={paymentTypes}
        onSuccess={handleSuccess}
      />

      <RegisterPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        voucher={voucherToPay}
        paymentTypes={paymentTypes}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
