import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Layers,
  ListTree,
  LayoutGrid,
  MousePointerClick,
  MousePointer2,
  Navigation,
  Rows3,
  Table2,
  Tag,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { entryHref, STYLE_GUIDE_CATEGORIES } from "@/components/style-guide/registry";

const CATEGORY_META: Record<string, { icon: LucideIcon; description: string }> = {
  inputs: { icon: MousePointerClick, description: "Controles con los que el usuario captura datos y dispara acciones." },
  visualization: { icon: LayoutGrid, description: "Componentes para mostrar datos: tablas, celdas, indicadores y estados." },
  navigation: { icon: Navigation, description: "Componentes para moverse entre secciones y filtrar contenido." },
};

const ENTRY_ICONS: Record<string, LucideIcon> = {
  button: MousePointer2,
  table: Table2,
  "tag-cell": Tags,
  "row-actions": Rows3,
  "primary-cell": UserRound,
  "stat-card": BarChart3,
  "status-badge": Tag,
  "nav-tree": ListTree,
  tabs: Layers,
};

/** Home of the style guide: every documented component grouped by category. */
export default function StyleGuideHomePage() {
  const total = STYLE_GUIDE_CATEGORIES.reduce((sum, category) => sum + category.entries.length, 0);

  return (
    <div className="space-y-12 pb-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Guía de estilos</h1>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            {total} componentes
          </span>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada componente cuenta con su propia ruta dedicada, con variantes documentadas en vivo y los parámetros que
          acepta.
        </p>
      </header>

      {STYLE_GUIDE_CATEGORIES.map((category) => {
        const meta = CATEGORY_META[category.key];
        const CategoryIcon = meta?.icon ?? LayoutGrid;
        return (
          <section key={category.key} className="space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{category.label}</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {category.entries.length} {category.entries.length === 1 ? "componente" : "componentes"}
                </span>
              </div>
              {meta ? <p className="text-sm text-muted-foreground">{meta.description}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {category.entries.map((entry) => {
                const Icon = ENTRY_ICONS[entry.slug] ?? CategoryIcon;
                return (
                  <Link
                    key={entry.slug}
                    href={entryHref(category.key, entry.slug)}
                    className="group flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 [&_svg]:size-5">
                        <Icon />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{category.label}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-lg font-bold leading-tight text-foreground">{entry.title}</h3>
                      <p className="text-sm text-muted-foreground">{entry.description}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800/80">
                      <span className="font-mono text-muted-foreground">{entry.slug}</span>
                      <span className="flex items-center gap-1 font-semibold text-blue-800 transition-transform group-hover:translate-x-0.5 dark:text-blue-300">
                        Explorar <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
