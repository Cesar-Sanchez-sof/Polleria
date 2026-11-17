"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Link2,
  Copy,
  CheckCheck,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  Users,
  Shield,
} from "lucide-react";
import type { DashboardShare } from "@prisma/client";

interface DashboardAccessEntry {
  type: "role" | "user";
  id: number;
  name: string;
  canView: boolean;
  canEdit: boolean;
}

interface AccessList {
  roles: { id: string; roleId: number; canView: boolean; canEdit: boolean; role: { id: number; name: string } }[];
  users: { id: string; userId: number; canView: boolean; canEdit: boolean; user: { id: number; username: string } }[];
}

interface ShareDialogProps {
  dashboardId: string;
  dashboardName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ShareDialog({ dashboardId, dashboardName, open, onOpenChange }: ShareDialogProps) {
  const [shares, setShares] = useState<DashboardShare[]>([]);
  const [accessList, setAccessList] = useState<AccessList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeShare = shares.find((s) => s.isActive) ?? null;
  const shareUrl = activeShare ? `${window.location.origin}/share/${activeShare.id}` : null;

  const fetchData = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/share`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Error al cargar datos");
      }
      const { data } = await res.json();
      setShares(data.shares ?? []);
      setAccessList(data.accessList ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId, open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateLink() {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Enlace de ${dashboardName ?? dashboardId}` }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Error al crear enlace");
      }
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(shareId: string) {
    setIsRevoking(shareId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/share/${shareId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Error al revocar enlace");
      }
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setIsRevoking(null);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback: select input
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Compartir tablero
          </DialogTitle>
          <DialogDescription>
            Gestiona el acceso y los enlaces compartidos de{" "}
            <span className="font-medium">{dashboardName ?? dashboardId}</span>.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              Enlace
            </TabsTrigger>
            <TabsTrigger value="access" className="flex-1">
              Acceso
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Enlace ── */}
          <TabsContent value="link" className="space-y-4 pt-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeShare ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Este enlace permite a cualquier usuario autenticado ver el tablero.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate select-all border">
                    {shareUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                    {isCopied ? <CheckCheck className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {isCopied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                    Activo
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive gap-1.5"
                    disabled={isRevoking === activeShare.id}
                    onClick={() => handleRevoke(activeShare.id)}
                  >
                    {isRevoking === activeShare.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Revocar enlace
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No hay un enlace activo. Genera uno para compartir este tablero.
                </p>
                <Button size="sm" onClick={handleCreateLink} disabled={isCreating} className="gap-1.5">
                  {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Generar enlace
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Acceso ── */}
          <TabsContent value="access" className="space-y-3 pt-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Roles */}
                {(accessList?.roles?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Shield className="size-3.5" />
                      Roles
                    </div>
                    <div className="space-y-1">
                      {accessList!.roles.map((ra) => (
                        <div key={ra.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/40">
                          <span>{ra.role.name}</span>
                          <div className="flex gap-1">
                            {ra.canEdit && <Badge variant="outline" className="text-[10px]">Editor</Badge>}
                            {ra.canView && !ra.canEdit && <Badge variant="outline" className="text-[10px]">Lector</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users */}
                {(accessList?.users?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Users className="size-3.5" />
                      Usuarios
                    </div>
                    <div className="space-y-1">
                      {accessList!.users.map((ua) => (
                        <div key={ua.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/40">
                          <span>{ua.user.username}</span>
                          <div className="flex gap-1">
                            {ua.canEdit && <Badge variant="outline" className="text-[10px]">Editor</Badge>}
                            {ua.canView && !ua.canEdit && <Badge variant="outline" className="text-[10px]">Lector</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(accessList?.roles?.length ?? 0) === 0 && (accessList?.users?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay reglas de acceso configuradas. El creador y los administradores siempre tienen acceso.
                  </p>
                )}

                <Separator />
                <p className="text-xs text-muted-foreground">
                  Para gestionar accesos granulares usa el panel de configuración del tablero.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
