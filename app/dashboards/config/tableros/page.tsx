import React from "react";
import {
  getDashboards,
  getSections,
  getRolesForAccess,
  getUsersForAccess,
} from "@/lib/services/settings/dashboard.service";
import { DashboardsTable } from "@/components/dashboards/config/DashboardsTable";
import { ConfigNavHeader } from "@/components/dashboards/config/ConfigNavHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administración de Tableros | ERP Pollería",
  description: "Gestión de tableros, permisos de roles y usuarios autorizados",
};

export default async function ConfigTablerosPage() {
  const [dashboards, sections, roles, users] = await Promise.all([
    getDashboards().catch(() => []),
    getSections().catch(() => []),
    getRolesForAccess().catch(() => []),
    getUsersForAccess().catch(() => []),
  ]);

  const availableRoles = roles.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.description,
  }));

  const availableUsers = users.map((u) => ({
    id: u.id,
    name: u.fullName,
    subtitle: u.email || `@${u.username}`,
  }));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ConfigNavHeader />
      <DashboardsTable
        initialDashboards={dashboards}
        sections={sections}
        availableRoles={availableRoles}
        availableUsers={availableUsers}
      />
    </div>
  );
}
