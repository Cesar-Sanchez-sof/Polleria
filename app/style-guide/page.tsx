import Link from "next/link";
import { entryHref, STYLE_GUIDE_CATEGORIES } from "@/components/style-guide/registry";

/** Home of the style guide: every documented component grouped by category. */
export default function StyleGuideHomePage() {
  return (
    <div className="space-y-8">
      {STYLE_GUIDE_CATEGORIES.map((category) => (
        <section key={category.key} className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {category.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {category.entries.map((entry) => (
              <Link
                key={entry.slug}
                href={entryHref(category.key, entry.slug)}
                className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-xs transition-colors hover:border-red-300 dark:border-slate-800"
              >
                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
