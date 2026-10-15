"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COMPONENT_USAGE, type StyleGuideComponent } from "./usage";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

// ─── Documentation helpers ────────────────────────────────────────────────────

export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

/** Card of a demo: title, description and the content (preview, parameters, code, props). */
export function Section({ title, description, children }: Readonly<{ title: string; description: string; children: ReactNode }>) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-xs dark:border-slate-800">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function Panel({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/30">
      {title ? <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p> : null}
      {children}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: Readonly<{ label: string; checked: boolean; onChange: (value: boolean) => void }>) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-red-700" />
      <code className="font-mono">{label}</code>
    </label>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: Readonly<{ label: string; value: T; options: readonly T[]; onChange: (value: T) => void }>) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <code className="font-mono">{label}</code>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Lays several ControlGroup blocks out in two columns (one on narrow screens). */
export function ControlGrid({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">{children}</div>;
}

/** Titled block of related parameter controls, aligned in a grid. */
export function ControlGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="space-y-2.5">
      <p className="border-b border-slate-200/80 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:border-slate-800">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function TextField({ label, value, onChange, width = "w-40" }: Readonly<{ label: string; value: string; onChange: (value: string) => void; width?: string }>) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <code className="font-mono">{label}</code>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 ${width}`}
      />
    </label>
  );
}

export function NumberField({ label, value, onChange, min = 0, max = 100 }: Readonly<{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }>) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <code className="font-mono">{label}</code>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  );
}

export function CodeBlock({ code }: Readonly<{ code: string }>) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
      <code>{code}</code>
    </pre>
  );
}

export function PropsTable({ docs }: Readonly<{ docs: readonly PropDoc[] }>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/50">
          <tr>
            <th className="px-4 py-2.5">Prop</th>
            <th className="px-4 py-2.5">Tipo</th>
            <th className="px-4 py-2.5">Por defecto</th>
            <th className="px-4 py-2.5">Descripción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {docs.map((doc) => (
            <tr key={doc.name}>
              <td className="px-4 py-2.5 font-mono font-semibold text-red-700">{doc.name}</td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">{doc.type}</td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">{doc.default ?? "—"}</td>
              <td className="px-4 py-2.5 text-foreground">{doc.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/** Page of one component: breadcrumb, title with category pill, description and demos. */
export function DocPage({ title, category, description, children }: Readonly<{ title: string; category: string; description: string; children: ReactNode }>) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/style-guide" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Guía de estilos
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Categoría: {category}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** "Vistas que lo usan": real screens that use the component, in two columns (list in `usage.ts`). */
export function UsedByViews({ component }: Readonly<{ component: StyleGuideComponent }>) {
  const views = COMPONENT_USAGE[component];
  return (
    <Section title="Vistas que lo usan" description="Pantallas del ERP que ya usan este componente. Un ajuste del componente se refleja en todas.">
      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no lo usa ninguna vista.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {views.map((view) => (
            <li key={view.href}>
              <Link
                href={view.href}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-red-300 hover:text-red-700 dark:border-slate-800"
              >
                <span className="truncate">{view.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
