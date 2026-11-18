import React from "react";
import { notFound, redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/current-session";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";
import {
  getSections,
  getDashboards,
  getDashboardById,
} from "@/lib/services/settings/dashboard.service";
import { DashboardDetailClientView } from "@/components/dashboards/DashboardDetailClientView";

export const dynamic = "force-dynamic";

interface DashboardDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DashboardDetailPage(props: DashboardDetailPageProps) {
  const { id } = await props.params;

  const [sections, dashboards, dashboard] = await Promise.all([
    getSections().catch(() => []),
    getDashboards().catch(() => []),
    getDashboardById(id).catch(() => null),
  ]);

  if (!dashboard) {
    notFound();
  }

  const session = await currentSession();
  if (!session) redirect("/login");
  const access = await getDashboardAccess(session.userId, id);
  if (!access.canView) {
    notFound();
  }

  return (
    <DashboardDetailClientView
      sections={sections}
      dashboards={dashboards}
      dashboard={dashboard}
      canEdit={access.canEdit}
    />
  );
}
