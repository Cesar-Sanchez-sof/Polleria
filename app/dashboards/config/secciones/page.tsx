import React from "react";
import { getSections } from "@/lib/services/dashboard.service";
import { SectionsTable } from "@/components/dashboards/config/SectionsTable";
import { ConfigNavHeader } from "@/components/dashboards/config/ConfigNavHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Secciones de Tableros | ERP Pollería",
  description: "Organización y reordenamiento de secciones del módulo de tableros",
};

export default async function ConfigSeccionesPage() {
  const sections = await getSections().catch(() => []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ConfigNavHeader />
      <SectionsTable initialSections={sections} />
    </div>
  );
}
