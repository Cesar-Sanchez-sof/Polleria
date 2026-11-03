import React from "react";
import { notFound } from "next/navigation";
import { getDashboardById } from "@/lib/services/dashboard.service";
import { DashboardCanvas } from "@/components/dashboards/DashboardCanvas";

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <DashboardCanvas dashboard={dashboard} />
    </div>
  );
}
