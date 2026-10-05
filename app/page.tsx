import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  ChefHat,
  CreditCard,
  Flame,
  Package,
  ShoppingCart,
  Utensils,
  Warehouse,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Pollería | Inicio",
  description: "Panel principal del ERP integral para restaurante y pollería.",
};

const QUICK_ACTIONS = [
  {
    href: "/sales?tab=tables",
    label: "Salón de mesas",
    hint: "Tomar pedidos en piso",
    icon: Utensils,
  },
  {
    href: "/sales?tab=kitchen",
    label: "Cocina KDS",
    hint: "Comandas en preparación",
    icon: ChefHat,
  },
  {
    href: "/sales?tab=cashier",
    label: "Caja y ventanilla",
    hint: "Cerrar cuentas",
    icon: CreditCard,
  },
  {
    href: "/sales?tab=tables",
    label: "Ventas",
    hint: "Gestión completa",
    icon: ShoppingCart,
  },
] as const;

const MODULES = [
  {
    href: "/sales?tab=tables",
    title: "Ventas y salón",
    description: "Mesas, para llevar, clientes, cobros y facturación electrónica.",
    icon: ShoppingCart,
    accent: "bg-primary/10 text-primary",
  },
  {
    href: "/purchases",
    title: "Compras e inventario",
    description: "Proveedores, órdenes, recepción, kardex y transformación.",
    icon: Package,
    accent: "bg-secondary/15 text-secondary",
  },
  {
    href: "/purchases/inventory",
    title: "Stock e insumos",
    description: "Control de existencias, ajustes y alertas de reorden.",
    icon: Warehouse,
    accent: "bg-emerald-100 text-emerald-800",
  },
  {
    href: "/accounting/entries",
    title: "Contabilidad",
    description: "Asientos, plan de cuentas, diario, mayor y resultados.",
    icon: BookOpen,
    accent: "bg-amber-100 text-amber-900",
  },
] as const;

function formatToday(): string {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HomePage() {
  const today = formatToday();

  return (
    <main className="pl-0 md:pl-64 min-h-screen w-full min-w-0 overflow-x-hidden bg-surface text-on-surface">
      {/* Hero — brand first, one composition */}
      <section className="relative min-h-[72vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=1800&auto=format&fit=crop&q=80)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(18,8,6,0.92) 0%, rgba(18,8,6,0.78) 42%, rgba(154,0,1,0.45) 100%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 0.6px, transparent 0.7px)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex min-h-[72vh] flex-col justify-end px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              ERP integral · {today}
            </p>

            <h1 className="font-headline text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Pollería
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Operá el salón, la cocina, las compras y la contabilidad desde un solo lugar.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/sales?tab=tables"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary-container active:scale-[0.98]"
              >
                Abrir salón
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sales?tab=cashier"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/18"
              >
                Ir a caja
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Accesos rápidos operativos */}
      <section className="px-6 py-8 sm:px-10 lg:px-14">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Operación de hoy</h2>
            <p className="text-sm text-outline">Atajos al flujo del restaurante</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-4 rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-on-surface">{action.label}</span>
                  <span className="block text-xs text-outline">{action.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-outline transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Módulos ERP */}
      <section className="px-6 pb-12 sm:px-10 lg:px-14">
        <div className="mb-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">Módulos del sistema</h2>
          <p className="text-sm text-outline">Administración comercial, logística y financiera</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group relative overflow-hidden rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/5 blur-2xl transition group-hover:bg-primary/10"
                  aria-hidden
                />
                <div className="relative flex items-start gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${module.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-headline text-base font-bold text-on-surface">
                        {module.title}
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-outline transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-outline">
                      {module.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
