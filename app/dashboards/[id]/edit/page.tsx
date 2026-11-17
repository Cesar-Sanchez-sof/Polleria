import React from "react";
import { notFound, redirect } from "next/navigation";
import { getDashboardById } from "@/lib/services/settings/dashboard.service";
import { DashboardCanvas } from "@/components/dashboards/DashboardCanvas";
import { currentSession } from "@/lib/auth/current-session";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";

export const dynamic = "force-dynamic";

interface EditDashboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDashboardPage(props: EditDashboardPageProps) {
  const { id } = await props.params;

  const dashboard = await getDashboardById(id).catch(() => null);

  if (!dashboard) {
    notFound();
  }

  const session = await currentSession();
  if (!session) redirect("/login");
  const access = await getDashboardAccess(session.userId, id);
  if (!access.canEdit) notFound();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <DashboardCanvas dashboard={dashboard} />
    </div>
  );
}
