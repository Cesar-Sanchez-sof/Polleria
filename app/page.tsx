import Link from "next/link";
import type { Metadata } from "next";
import { requireServerSession } from "@/lib/auth/guard";
import { getBranding } from "@/lib/services/settings/branding.service";
import type { UpdateEntry } from "@/lib/branding/defaults";
import { ArrowRight, Flame, Megaphone } from "lucide-react";

// El nombre y los textos se editan desde Configuración → Personalización.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getBranding();
  return {
    title: `${content.home.title} | Inicio`,
    description: "Panel principal del ERP integral para restaurante y pollería.",
  };
}

function formatToday(): string {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "2026-11-03" -> "3 nov" (con el año si no es el actual). Al mediodía para que la zona horaria no cambie el día. */
function formatUpdateDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return parsed.toLocaleDateString("es-PE", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

function UpdatesPanel({ title, updates }: Readonly<{ title: string; updates: UpdateEntry[] }>) {
  return (
    <aside
      aria-label={title}
      className="w-full shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/40 text-white shadow-2xl backdrop-blur-md lg:w-96"
    >
      <header className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300/15 text-amber-300">
          <Megaphone className="h-4 w-4" />
        </span>
        <h2 className="font-headline text-sm font-bold uppercase tracking-[0.14em] text-white/90">{title}</h2>
      </header>
      <ol className="max-h-[46vh] space-y-0 overflow-y-auto px-5 py-4 lg:max-h-[56vh]">
        {updates.map((update, index) => (
          <li key={`${update.date}-${update.title}-${index}`} className="relative pb-5 pl-5 last:pb-0">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
            {index < updates.length - 1 ? (
              <span className="absolute bottom-0 left-[3px] top-4 w-px bg-white/15" aria-hidden />
            ) : null}
            <time dateTime={update.date} className="block text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
              {formatUpdateDate(update.date)}
            </time>
            <p className="mt-0.5 text-sm font-bold leading-snug text-white">{update.title}</p>
            {update.description ? <p className="mt-1 text-xs leading-relaxed text-white/70">{update.description}</p> : null}
          </li>
        ))}
      </ol>
    </aside>
  );
}

export default async function HomePage() {
  await requireServerSession();
  const today = formatToday();
  const { content, assets } = await getBranding();
  const home = content.home;

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-surface text-on-surface">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${assets["home-hero"]})` }}
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
            backgroundImage: "radial-gradient(circle at 20% 20%, #fff 0.6px, transparent 0.7px)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex min-h-screen flex-col justify-end gap-8 px-6 py-10 sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:py-14">
          <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              {home.eyebrow} · {today}
            </p>

            <h1 className="font-headline text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {home.title}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{home.subtitle}</p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={home.primaryHref}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary-container active:scale-[0.98]"
              >
                {home.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={home.secondaryHref}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/18"
              >
                {home.secondaryLabel}
              </Link>
            </div>
          </div>

          {home.updates.length > 0 ? <UpdatesPanel title={home.updatesTitle} updates={home.updates} /> : null}
        </div>
      </section>
    </main>
  );
}
