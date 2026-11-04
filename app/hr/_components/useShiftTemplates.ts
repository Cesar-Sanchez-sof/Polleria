"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShiftTemplateDto } from "@/lib/services/hr/shift-templates.service";
import { api } from "../_lib/hr-client";

/** Turnos base para armar el horario pactado de los contratos. */
export function useShiftTemplates(enabled = true) {
  const [templates, setTemplates] = useState<ShiftTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setTemplates(await api<ShiftTemplateDto[]>("/api/shift-templates"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los turnos base");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos al abrir
    if (enabled) reload();
  }, [enabled, reload]);

  return { templates, error, reload };
}
