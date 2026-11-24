"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  GitBranch,
  KeyRound,
  ServerCog,
  Terminal,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  ManualPrintButton,
  ManualPrintFooter,
  ManualPrintHeader,
  ManualPrintPageStyle,
} from "@/components/docs/ManualPrintToolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEPLOYMENT_ENV_VARS,
  DEPLOYMENT_SECTIONS,
  DEPLOYMENT_TROUBLESHOOTING,
} from "./deployment-data";

/**
 * Manual Técnico de Despliegue e Infraestructura de Pollería ERP.
 * Protegido por el permiso `despliegue.ver`.
 */
export default function DeploymentManualPage() {
  const [selectedService, setSelectedService] = useState<string>("Todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const services = ["Todos", "Base de Datos", "Next.js / Vercel", "Integraciones", "Asistente IA / Agents"];

  const filteredVars =
    selectedService === "Todos"
      ? DEPLOYMENT_ENV_VARS
      : DEPLOYMENT_ENV_VARS.filter((v) => v.service === selectedService);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      /* portapapeles no disponible */
    }
  }

  return (
    <main className="manual-doc-print min-h-screen bg-background pb-14 print:pb-0">
      <ManualPrintPageStyle />
      <ModuleHeader
        title="Manual de Despliegue e Infraestructura"
        subtitle="Guía técnica de entorno, variables, base de datos, servicios cloud y pipeline CI/CD."
        icon={ServerCog}
        iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      >
        <ManualPrintButton documentTitle="Manual_de_Despliegue_Polleria_ERP" />
      </ModuleHeader>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 print:max-w-none print:space-y-5 print:px-0 print:py-0">
        <ManualPrintHeader
          docCode="DOC-MAN-DES-01"
          title="Manual de Despliegue e Infraestructura"
          subtitle="Guía técnica oficial de arquitectura cloud, variables de entorno, base de datos PostgreSQL/Neon y pipeline CI/CD."
          scopeLabel={`Variables: ${selectedService}`}
          tocItems={[
            ...DEPLOYMENT_SECTIONS.map((s) => ({
              id: s.id,
              category: s.badge,
              title: s.title,
            })),
            { id: "env-vars", category: "5. Config", title: "Matriz de Variables de Entorno" },
            { id: "troubleshooting", category: "6. Soporte", title: "Solución de Problemas en Despliegue" },
          ]}
        />
        {/* Resumen rápido del stack */}
        <div className="manual-print-avoid-break grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Runtime Web/API</p>
                <p className="text-sm font-bold text-foreground">Next.js 16.4 · Node.js 24</p>
                <p className="text-xs text-muted-foreground">Despliegue recomendado en Vercel</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Persistencia</p>
                <p className="text-sm font-bold text-foreground">PostgreSQL (Neon) + Prisma 6</p>
                <p className="text-xs text-muted-foreground">Zona horaria America/Lima (UTC-5)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CI/CD GitHub</p>
                <p className="text-sm font-bold text-foreground">develop → main</p>
                <p className="text-xs text-muted-foreground">Vitest, Build, ESLint y Playwright E2E</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secciones paso a paso */}
        <div className="space-y-6">
          {DEPLOYMENT_SECTIONS.map((section) => (
            <Card key={section.id} id={section.id} className="print:border-[#e7d4cf] print:border-t-[3px] print:border-t-[#9a0001] print:shadow-none print:bg-white">
              <CardHeader className="manual-print-avoid-break border-b border-border/70 bg-muted/20 print:bg-[#fff8f6] print:border-[#f0e2de]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{section.badge}</Badge>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.summary}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 p-6">
                <ul className="space-y-2 text-sm text-foreground">
                  {section.checklist.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {section.commands && section.commands.length > 0 ? (
                  <div className="space-y-3">
                    {section.commands.map((cmd, idx) => {
                      const blockId = `${section.id}-${idx}`;
                      const isCopied = copiedId === blockId;
                      return (
                        <div key={blockId} className="manual-print-avoid-break overflow-hidden rounded-xl border border-border bg-slate-950 text-slate-100 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 print:border-slate-300 print:bg-slate-100">
                            <span className="text-xs font-semibold text-slate-300 print:text-slate-800">{cmd.label}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(blockId, cmd.command)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white print:hidden cursor-pointer"
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              {isCopied ? "Copiado" : "Copiar"}
                            </button>
                          </div>
                          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed print:whitespace-pre-wrap print:break-words">
                            <code>{cmd.command}</code>
                          </pre>
                          {cmd.notes ? (
                            <p className="border-t border-slate-800 bg-slate-900/50 px-4 py-2 text-[11px] text-slate-400 print:border-slate-300 print:bg-slate-100/70 print:text-slate-700">
                              {cmd.notes}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Matriz de variables de entorno */}
        <Card id="env-vars" className="print:border-[#e7d4cf] print:border-t-[3px] print:border-t-[#9a0001] print:shadow-none print:bg-white">
          <CardHeader className="manual-print-avoid-break border-b border-border/70 bg-muted/20 print:bg-[#fff8f6] print:border-[#f0e2de]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-lg">Variables de Entorno (.env.example.front)</CardTitle>
                </div>
                <CardDescription>
                  Configura estas variables en tu servidor o en Vercel/Render. Nunca subas secretos reales al repositorio.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-1.5 print:hidden">
                {services.map((srv) => (
                  <button
                    key={srv}
                    type="button"
                    onClick={() => setSelectedService(srv)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      selectedService === srv
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {srv}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Variable(s)</th>
                    <th className="px-4 py-3 font-semibold">Servicio</th>
                    <th className="px-4 py-3 font-semibold">Requerida</th>
                    <th className="px-4 py-3 font-semibold">Descripción y ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVars.map((env) => (
                    <tr key={env.name} className="manual-print-avoid-break hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground print:break-all">{env.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{env.service}</td>
                      <td className="px-4 py-3">
                        {env.required ? (
                          <Badge variant="default" className="text-[10px]">Obligatoria</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <p className="text-foreground">{env.description}</p>
                        <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px]">
                          {env.example}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Diagnóstico y Troubleshooting */}
        <Card id="troubleshooting" className="print:border-[#e7d4cf] print:border-t-[3px] print:border-t-[#9a0001] print:shadow-none print:bg-white">
          <CardHeader className="manual-print-avoid-break border-b border-border/70 bg-muted/20 print:bg-[#fff8f6] print:border-[#f0e2de]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-lg">Solución de Problemas en Despliegue</CardTitle>
            </div>
            <CardDescription>Incidentes comunes al levantar la aplicación o ejecutar el pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            {DEPLOYMENT_TROUBLESHOOTING.map((item) => (
              <div key={item.symptom} className="manual-print-avoid-break rounded-xl border border-border bg-muted/20 p-4 space-y-1.5 print:border-slate-300 print:bg-slate-50">
                <p className="text-sm font-bold text-foreground">{item.symptom}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Causa:</span> {item.cause}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Solución:</span> {item.resolution}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ManualPrintFooter docCode="DOC-MAN-DES-01" />
      </div>
    </main>
  );
}
