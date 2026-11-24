"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { Button } from "@/components/ui/button";
import { ASSET_FALLBACKS, DEFAULT_BRANDING } from "@/lib/branding/defaults";

interface CorporatePrintInfo {
  fullName: string;
  tagline: string;
  slogan: string;
  rights: string;
  businessName?: string;
  ruc?: string;
  address?: string;
  phone?: string;
}

const FALLBACK_CORPORATE_INFO: CorporatePrintInfo = {
  fullName: DEFAULT_BRANDING.fullName,
  tagline: DEFAULT_BRANDING.tagline,
  slogan: DEFAULT_BRANDING.slogan,
  rights: DEFAULT_BRANDING.login.rights,
};

interface ManualPrintButtonProps {
  /** Nombre sugerido para el archivo PDF al imprimir desde el navegador. */
  documentTitle: string;
}

/**
 * Botón de impresión / exportación a PDF exclusivo para administradores (`superuser`).
 * Ajusta temporalmente `document.title` para que el PDF generado tenga un nombre legible.
 */
export function ManualPrintButton({ documentTitle }: Readonly<ManualPrintButtonProps>) {
  const { loading, superuser } = usePermissions();

  if (loading || !superuser) return null;

  function handlePrint() {
    const previousTitle = document.title;
    document.title = documentTitle;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    window.addEventListener("afterprint", restoreTitle);
    window.print();

    // Respaldo si el navegador no dispara `afterprint` al cancelar.
    setTimeout(restoreTitle, 1500);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="gap-1.5 print:hidden cursor-pointer border-red-200 text-red-800 hover:bg-red-50 hover:text-red-900 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
      title="Imprimir o guardar como PDF corporativo A4 (solo Administrador)"
    >
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">Imprimir / PDF</span>
    </Button>
  );
}

/**
 * Inyecta el tamaño de página A4 vertical con numeración de pie de página
 * solo mientras el manual está montado, sin alterar los tickets térmicos de 80mm.
 */
export function ManualPrintPageStyle() {
  return (
    <style>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 14mm 14mm 17mm 14mm !important;
          @bottom-left {
            content: "Pollería ERP · Documentación Corporativa";
            font-size: 8.5pt;
            color: #64748b;
          }
          @bottom-right {
            content: "Pág. " counter(page) " de " counter(pages);
            font-size: 8.5pt;
            font-weight: 600;
            color: #9a0001;
          }
        }
      }
    `}</style>
  );
}

/**
 * Obtiene identidad de marca y datos fiscales reales de la pollería solo cuando el usuario
 * es Administrador (`superuser`) para enriquecer la portada de impresión física/PDF.
 */
function useCorporatePrintInfo(enabled: boolean): CorporatePrintInfo {
  const [info, setInfo] = useState<CorporatePrintInfo>(FALLBACK_CORPORATE_INFO);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/settings/branding", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/settings/restaurant", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([brandingRes, restaurantRes]) => {
      if (cancelled) return;
      const content = brandingRes?.data?.content;
      const restaurant = restaurantRes?.data;

      setInfo({
        fullName: content?.fullName || restaurant?.commercialName || DEFAULT_BRANDING.fullName,
        tagline: content?.tagline || DEFAULT_BRANDING.tagline,
        slogan: content?.slogan || DEFAULT_BRANDING.slogan,
        rights: content?.login?.rights || DEFAULT_BRANDING.login.rights,
        businessName: restaurant?.businessName || undefined,
        ruc: restaurant?.ruc || undefined,
        address: restaurant?.address || undefined,
        phone: restaurant?.phone || undefined,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return info;
}

interface ManualPrintTocItem {
  id: string;
  category: string;
  title: string;
}

interface ManualPrintHeaderProps {
  docCode: string;
  title: string;
  subtitle: string;
  scopeLabel?: string;
  tocItems?: readonly ManualPrintTocItem[];
}

/**
 * Portada / cabecera corporativa con logo, colores de la pollería, datos fiscales
 * e índice imprimible. Visible únicamente en impresión física y exportación a PDF.
 */
export function ManualPrintHeader({
  docCode,
  title,
  subtitle,
  scopeLabel,
  tocItems,
}: Readonly<ManualPrintHeaderProps>) {
  const { superuser } = usePermissions();
  const corporate = useCorporatePrintInfo(superuser);
  const [logoSrc, setLogoSrc] = useState("/api/branding/assets/logo");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setGeneratedAt(
      new Date().toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  if (!superuser) return null;

  return (
    <section className="hidden print:block mb-6 space-y-4">
      <div className="manual-print-avoid-break overflow-hidden rounded-xl border border-[#e7d4cf] bg-white">
        {/* Banda superior con los colores institucionales de la Pollería */}
        <div
          className="h-2.5 w-full"
          style={{
            background: "linear-gradient(90deg, #9a0001 0%, #c70202 62%, #d97706 100%)",
          }}
        />

        {/* Cabecera de empresa: Logo + Razón social + Metadatos del documento */}
        <div className="flex items-center justify-between gap-4 border-b border-[#f0e2de] px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e7d4cf] bg-[#fff8f6] p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt={corporate.fullName}
                onError={() => setLogoSrc(ASSET_FALLBACKS.logo)}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9a0001]">
                {corporate.tagline}
              </p>
              <h2 className="text-xl font-black tracking-tight text-[#0d1c2e]">
                {corporate.fullName}
              </h2>
              <p className="text-[10.5px] italic text-[#5d4a48]">{corporate.slogan}</p>
              {(corporate.ruc || corporate.businessName || corporate.address) ? (
                <p className="mt-1 text-[9.5px] text-slate-600">
                  {[
                    corporate.businessName,
                    corporate.ruc ? `RUC ${corporate.ruc}` : null,
                    corporate.address,
                    corporate.phone ? `Tel. ${corporate.phone}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-[#e7d4cf] bg-[#fff8f6] px-3.5 py-2.5 text-right text-[10px]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a0001]">
              {docCode}
            </p>
            {scopeLabel ? (
              <p className="mt-0.5 font-bold text-[#0d1c2e]">{scopeLabel}</p>
            ) : null}
            {generatedAt ? (
              <p className="mt-0.5 text-slate-600">Emisión: {generatedAt}</p>
            ) : null}
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">
              Documento Oficial
            </p>
          </div>
        </div>

        {/* Bloque principal del título del manual */}
        <div className="bg-gradient-to-r from-[#fff8f6] via-white to-[#fffbeb] px-5 py-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#b45309]">
            Manual Corporativo de Operaciones
          </p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[#0d1c2e]">{title}</h1>
          <p className="mt-1 text-xs leading-relaxed text-[#475569]">{subtitle}</p>
        </div>
      </div>

      {/* Tabla de contenidos impresa para encuadernado o carpeta física */}
      {tocItems && tocItems.length > 0 ? (
        <div className="manual-print-avoid-break rounded-xl border border-[#e7d4cf] bg-[#fffdfc] px-5 py-3.5">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9a0001]">
            Contenido del Documento ({tocItems.length} secciones)
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            {tocItems.map((item, idx) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2 border-b border-dotted border-slate-300 py-1">
                <span className="font-semibold text-[#0d1c2e]">
                  <span className="mr-1.5 font-bold text-[#9a0001]">{idx + 1}.</span>
                  {item.title}
                </span>
                <span className="shrink-0 text-[9.5px] font-medium uppercase text-[#755943]">
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Pie de cierre corporativo visible al final del documento impreso / PDF.
 */
export function ManualPrintFooter({ docCode }: Readonly<{ docCode: string }>) {
  const { superuser } = usePermissions();
  const corporate = useCorporatePrintInfo(superuser);

  if (!superuser) return null;

  return (
    <footer className="hidden print:block manual-print-avoid-break mt-6 border-t-2 border-[#9a0001]/30 pt-3 text-[10px] text-slate-600">
      <div className="flex items-center justify-between gap-4">
        <p>
          <span className="font-bold text-[#9a0001]">{corporate.fullName}</span> · {corporate.slogan}
        </p>
        <p className="font-medium text-slate-500">
          {docCode} · {corporate.rights}
        </p>
      </div>
    </footer>
  );
}
