"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  Lightbulb,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  ManualPrintButton,
  ManualPrintFooter,
  ManualPrintHeader,
  ManualPrintPageStyle,
} from "@/components/docs/ManualPrintToolbar";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ROLE_PREVIEW_PRESETS,
  USER_MANUAL_SECTIONS,
  filterManualSections,
  type ManualSection,
} from "./manual-data";

/**
 * Manual de Usuario interactivo y sensible a permisos RBAC.
 * En escritorio mantiene el índice lateral estático mientras el contenido se desplaza de forma independiente.
 */
export default function UserManualPage() {
  const { loading, superuser, can, canAny } = usePermissions();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [previewRoleId, setPreviewRoleId] = useState("current");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const activePreset = useMemo(
    () => ROLE_PREVIEW_PRESETS.find((p) => p.id === previewRoleId) ?? ROLE_PREVIEW_PRESETS[0],
    [previewRoleId],
  );

  const previewPermissions = superuser ? activePreset.permissions : null;

  /** Todas las secciones permitidas para el usuario (o preset) antes de aplicar filtros de UI. */
  const permittedSections = useMemo(
    () =>
      filterManualSections(USER_MANUAL_SECTIONS, {
        superuser,
        canAny,
        previewPermissions,
      }),
    [superuser, canAny, previewPermissions],
  );

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(permittedSections.map((s) => s.category)))],
    [permittedSections],
  );

  const effectiveCategory = categories.includes(selectedCategory) ? selectedCategory : "Todas";

  const visibleSections = useMemo(
    () =>
      filterManualSections(USER_MANUAL_SECTIONS, {
        superuser,
        canAny,
        previewPermissions,
        category: effectiveCategory,
        query: search,
      }),
    [superuser, canAny, previewPermissions, effectiveCategory, search],
  );

  const canUseAction = (permission?: string) => {
    if (!permission) return true;
    if (previewPermissions !== null) return previewPermissions.includes(permission);
    return can(permission);
  };

  // Resalta en el índice estático el módulo que el usuario está leyendo en el panel derecho.
  useEffect(() => {
    const root = contentScrollRef.current;
    if (!root || visibleSections.length === 0) return;

    setActiveSectionId((prev) =>
      visibleSections.some((s) => s.id === prev) ? prev : visibleSections[0].id,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        root,
        rootMargin: "-12px 0px -65% 0px",
        threshold: 0.05,
      },
    );

    const cards = visibleSections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    cards.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [visibleSections]);

  function scrollToSection(id: string) {
    setActiveSectionId(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <main className="manual-doc-print flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden print:block print:h-auto print:overflow-visible">
      <ManualPrintPageStyle />
      <ModuleHeader
        title="Manual de Usuario"
        subtitle="Instructivo operativo personalizado según los permisos de tu rol en el sistema."
        icon={BookOpenCheck}
        iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <ManualPrintButton documentTitle="Manual_de_Usuario_Polleria_ERP" />
      </ModuleHeader>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:min-h-0 print:block print:max-w-none print:px-0 print:py-0">
        <ManualPrintHeader
          docCode="DOC-MAN-USR-01"
          title="Manual de Usuario del Sistema"
          subtitle="Guía operativa paso a paso para el personal de salón, cocina, caja, compras, contabilidad y recursos humanos."
          scopeLabel={
            previewPermissions !== null
              ? activePreset.label
              : `Módulos incluidos: ${visibleSections.length}`
          }
          tocItems={visibleSections.map((s) => ({
            id: s.id,
            category: s.category,
            title: s.title,
          }))}
        />
        {/* Barra fija de búsqueda y filtro de categorías */}
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar acción, pantalla o módulo..."
              className="pl-9"
              aria-label="Buscar en el manual de usuario"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const active = effectiveCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout de dos paneles: Índice lateral estático + Contenido desplazable */}
        <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[270px_minmax(0,1fr)] print:block">
          <aside
            aria-label="Índice del manual de usuario"
            className="hidden lg:flex lg:min-h-0 lg:flex-col rounded-2xl border border-border bg-card p-4 shadow-xs print:hidden"
          >
            <p className="mb-3 shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Índice ({visibleSections.length})
            </p>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
              {visibleSections.map((sec, idx) => {
                const isActive = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary/10 font-bold text-primary"
                        : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`block text-[10px] font-semibold uppercase tracking-wide ${
                        isActive ? "text-primary" : "text-primary/75"
                      }`}
                    >
                      {idx + 1}. {sec.category}
                    </span>
                    <span className="line-clamp-2 leading-snug">{sec.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div
            ref={contentScrollRef}
            className="space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:pb-10 print:overflow-visible print:pr-0 print:pb-0"
          >
            {/* Banner resumen de alcance según permisos */}
            <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20 print:hidden">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {loading
                        ? "Cargando permisos..."
                        : `${permittedSections.length} de ${USER_MANUAL_SECTIONS.length} instructivos habilitados`}
                    </span>
                    {superuser && previewPermissions === null ? (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Acceso total de Administrador
                      </Badge>
                    ) : null}
                    {previewPermissions !== null ? (
                      <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                        <Eye className="h-3 w-3" /> Vista previa: {activePreset.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {previewPermissions !== null
                      ? activePreset.description
                      : "Este manual muestra automáticamente las guías generales y los instructivos correspondientes a las pantallas autorizadas para tu usuario."}
                  </p>
                </div>

                {superuser ? (
                  <div className="flex flex-col gap-1.5 sm:min-w-64 print:hidden">
                    <label htmlFor="manual-role-preview" className="text-xs font-semibold text-muted-foreground">
                      Previsualizar manual como rol:
                    </label>
                    <select
                      id="manual-role-preview"
                      value={previewRoleId}
                      onChange={(e) => setPreviewRoleId(e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {ROLE_PREVIEW_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {visibleSections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No se encontraron instructivos para tu búsqueda actual.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prueba limpiando el texto de búsqueda o cambiando la categoría seleccionada.
                  </p>
                </CardContent>
              </Card>
            ) : (
              visibleSections.map((section) => (
                <ManualSectionCard
                  key={section.id}
                  section={section}
                  canUseAction={canUseAction}
                />
              ))
            )}

            <ManualPrintFooter docCode="DOC-MAN-USR-01" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ManualSectionCard({
  section,
  canUseAction,
}: {
  section: ManualSection;
  canUseAction: (permission?: string) => boolean;
}) {
  return (
    <Card id={section.id} className="scroll-mt-4 overflow-hidden print:border-[#e7d4cf] print:border-t-[3px] print:border-t-[#9a0001] print:shadow-none print:bg-white">
      <CardHeader className="manual-print-avoid-break border-b border-border/70 bg-muted/20 print:bg-[#fff8f6] print:border-[#f0e2de]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{section.category}</Badge>
              {section.roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-[11px]">
                  {role}
                </Badge>
              ))}
            </div>
            <CardTitle className="text-xl">{section.title}</CardTitle>
            <CardDescription>{section.summary}</CardDescription>
          </div>

          {section.href ? (
            <Link
              href={section.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary print:hidden"
            >
              Ir al módulo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Prerrequisitos */}
        {section.prerequisites.length > 0 ? (
          <div className="manual-print-avoid-break rounded-xl border border-border/80 bg-muted/30 p-4 print:bg-slate-50 print:border-slate-300">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Antes de comenzar
            </p>
            <ul className="space-y-1.5 text-sm text-foreground">
              {section.prerequisites.map((req) => (
                <li key={req} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Pasos operativos */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Procedimiento paso a paso
          </p>
          <ol className="space-y-3">
            {section.steps.map((step, index) => {
              const allowed = canUseAction(step.actionPermission);
              return (
                <li
                  key={step.title}
                  className={`manual-print-avoid-break rounded-xl border p-4 transition-colors print:bg-white print:border-slate-300 ${
                    allowed
                      ? "border-border bg-card"
                      : "border-dashed border-border/70 bg-muted/20 opacity-80"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary print:bg-[#9a0001] print:text-white">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-bold text-foreground print:text-[#0d1c2e]">{step.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {step.where ? (
                        <code className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {step.where}
                        </code>
                      ) : null}
                      {step.actionPermission ? (
                        allowed ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Habilitado ({step.actionPermission})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" /> Solo lectura ({step.actionPermission})
                          </Badge>
                        )
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 pl-8 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Buenas prácticas */}
        {section.tips.length > 0 ? (
          <div className="manual-print-avoid-break rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 print:bg-amber-50/50 print:border-amber-300">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Lightbulb className="h-4 w-4" />
              Recomendaciones operativas
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {section.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Solución de problemas frecuentes */}
        {section.troubleshooting && section.troubleshooting.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              Problemas frecuentes
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {section.troubleshooting.map((item) => (
                <div key={item.problem} className="manual-print-avoid-break rounded-xl border border-border bg-muted/20 p-3.5 print:bg-slate-50 print:border-slate-300">
                  <p className="text-xs font-bold text-foreground">{item.problem}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.solution}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
