"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  QrCode,
  Smartphone,
  Copy,
  Receipt,
  Utensils,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface CheckoutData {
  orderId: number;
  code: string;
  status: string;
  tableName: string;
  total: number;
  merchantName: string;
  phoneClean: string;
  phoneDisplay: string;
  existingInvoice?: {
    fullCode: string;
    total: number;
    issuedAt: string;
  } | null;
  items: OrderItem[];
}

function YapeCheckoutContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [paidResult, setPaidResult] = useState<{
    invoiceCode?: string;
    paymentId?: string;
    date?: string;
  } | null>(null);
  const [showItems, setShowItems] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const loadOrder = async () => {
    if (!orderId) {
      setError("No se especificó el número de comanda en el enlace.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/checkout/yape?orderId=${orderId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la información del pedido.");
      setData(json);

      if (json.status === "Closed" && json.existingInvoice) {
        setPaidResult({
          invoiceCode: json.existingInvoice.fullCode,
          paymentId: `MP-PAGADO-${json.orderId}`,
          date: new Date(json.existingInvoice.issuedAt).toLocaleString("es-PE"),
        });
      }
    } catch (err: any) {
      setError(err.message || "Error de red al consultar el cobro.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  const handleSimulatePayment = async () => {
    if (!data || submitting) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/checkout/yape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: data.orderId,
          voucherType: "Boleta",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo procesar la simulación de cobro.");

      setPaidResult({
        invoiceCode: json.invoice?.fullCode || "B001-XXXXXX",
        paymentId: json.paymentId || `MP-YAPE-${Date.now()}`,
        date: new Date().toLocaleString("es-PE"),
      });
    } catch (err: any) {
      alert(err.message || "Error al simular el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPhone = () => {
    if (!data?.phoneClean) return;
    navigator.clipboard.writeText(data.phoneClean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-purple-700 flex items-center justify-center shadow-lg animate-pulse mb-4">
          <QrCode className="w-9 h-9 text-white" />
        </div>
        <p className="text-sm font-bold text-slate-300">Cargando datos de cobro Yape...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">Comanda no disponible</h2>
        <p className="text-xs text-slate-400 max-w-xs mb-4">{error || "Pedido no encontrado."}</p>
        <button
          onClick={() => void loadOrder()}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center items-start sm:py-8 p-0 sm:p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden min-h-screen sm:min-h-0 flex flex-col">
        {/* Cabecera Estilo Yape */}
        <div className="bg-[#742284] p-5 text-white flex flex-col items-center relative text-center">
          <div className="w-12 h-12 rounded-full bg-white text-[#742284] font-black text-xl flex items-center justify-center shadow-md mb-2">
            Y
          </div>
          <span className="text-xs tracking-wider font-extrabold uppercase text-purple-200">
            Yapear a Comercio
          </span>
          <h1 className="text-lg font-black tracking-tight mt-0.5 line-clamp-1">
            {data.merchantName}
          </h1>
          <span className="text-[11px] text-purple-200/90 font-medium">
            {data.tableName} • Comanda #{data.code}
          </span>
        </div>

        {/* Contenido Principal */}
        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
          {paidResult ? (
            /* Vista de Yapeo Exitoso */
            <div className="flex flex-col items-center text-center py-4 gap-3 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wide">
                  ¡Yapeo Exitoso!
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-0.5">
                  S/ {data.total.toFixed(2)}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pagado a <strong>{data.merchantName}</strong>
                </p>
              </div>

              {/* Voucher Digital */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2 mt-1 shadow-2xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Comprobante emitido:</span>
                  <span className="font-mono font-black text-slate-900">{paidResult.invoiceCode}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">ID de Transacción Yape:</span>
                  <span className="font-mono font-bold text-slate-700 text-[11px]">{paidResult.paymentId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Fecha y hora:</span>
                  <span className="text-slate-700 font-medium">{paidResult.date}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 font-medium">Estado en restaurante:</span>
                  <span className="font-bold text-emerald-600">✓ Mesa Liberada</span>
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-left text-[11px] text-purple-900 w-full flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0" />
                <span>
                  El sistema del restaurante (mozos, caja y cocina) ya recibió la confirmación en tiempo real.
                </span>
              </div>
            </div>
          ) : (
            /* Vista de Confirmación de Pago */
            <div className="flex flex-col gap-4">
              {/* Tarjeta de Destinatario y Monto */}
              <div className="bg-purple-50/80 border-2 border-purple-200 rounded-2xl p-4 flex flex-col items-center text-center gap-2">
                <span className="text-xs font-bold text-purple-900">Monto total a yapear:</span>
                <span className="text-3xl font-black text-[#742284]">
                  S/ {data.total.toFixed(2)}
                </span>

                <div className="w-full pt-2 border-t border-purple-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Número Yape:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-purple-950 text-sm">
                      {data.phoneDisplay || data.phoneClean}
                    </span>
                    <button
                      type="button"
                      onClick={copyPhone}
                      className="p-1 hover:bg-purple-200/60 rounded text-purple-700 transition-colors"
                      title="Copiar número"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {copied && <span className="text-[10px] text-emerald-600 font-bold">¡Copiado!</span>}
                  </div>
                </div>
              </div>

              {/* Botón Desplegable para ver platos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowItems(!showItems)}
                  className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 text-left text-xs font-bold text-slate-700 flex justify-between items-center transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-purple-700" />
                    <span>Ver detalle del pedido ({data.items.length} platos)</span>
                  </span>
                  {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showItems && (
                  <div className="p-3 bg-white space-y-1.5 max-h-48 overflow-y-auto border-t border-slate-200">
                    {data.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-800 font-medium">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          S/ {it.subtotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Banner de Entorno de Prueba */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-[11px] text-slate-600 flex items-start gap-2 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Modo Simulación de Cobro Yape
                  </span>
                  <span>
                    No se debitará dinero real de tu cuenta bancaria. Al presionar el botón morado se registrará el pago en la base de datos de la pollería, emitiendo la boleta electrónica y liberando la mesa.
                  </span>
                </div>
              </div>

              {/* Botón Principal para Yapear */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSimulatePayment}
                className="w-full py-3.5 bg-[#742284] hover:bg-[#5e1b6b] active:scale-[0.99] text-white rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 cursor-pointer transition-all disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Confirmando pago con Yape...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 text-white" />
                    <span>YAPEAR S/ {data.total.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Pie de Página */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3 h-3 text-purple-700" />
              Cobro Directo Yape • Pollería & Brasas
            </span>
            <span>Comanda #{data.code}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function YapeCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
          Cargando pasarela Yape...
        </div>
      }
    >
      <YapeCheckoutContent />
    </Suspense>
  );
}
