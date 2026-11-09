import React from "react";
import { getShareLinks, getDashboards } from "@/lib/services/settings/dashboard.service";
import { ShareLinksTable } from "@/components/dashboards/config/ShareLinksTable";
import { ConfigNavHeader } from "@/components/dashboards/config/ConfigNavHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Enlaces Compartidos | ERP Pollería",
  description: "Administración y control de enlaces compartidos de tableros",
};

export default async function ConfigEnlacesPage() {
  const [links, dashboards] = await Promise.all([
    getShareLinks().catch(() => []),
    getDashboards().catch(() => []),
  ]);

  const availableDashboards = dashboards.map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ConfigNavHeader />
      <ShareLinksTable
        initialLinks={links}
        availableDashboards={availableDashboards}
      />
    </div>
  );
}
