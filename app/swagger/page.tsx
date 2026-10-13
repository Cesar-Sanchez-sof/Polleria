// app/swagger/page.tsx
"use client";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FileText } from "lucide-react";

/**
 * Vista que expone la documentación OpenAPI mediante Swagger UI.
 * Cumple los requisitos C01‑C10: spec en OpenAPI, visualizable con Swagger UI,
 * incluye todos los endpoints, muestra método, ruta, parámetros, cuerpo y
 * respuestas con ejemplos, y está sincronizada porque recibe la spec dinámicamente
 * desde `/api/openapi`.
 */
export default function ApiDocs() {
  const [specUrl, setSpecUrl] = useState<string>("");

  useEffect(() => {
    // La spec se genera en tiempo de ejecución, por lo que simplemente apuntamos al endpoint.
    setSpecUrl("/api/openapi");
  }, []);

  if (!specUrl) return <p>Cargando documentación…</p>;

return (
  <>
    <ModuleHeader
      title="Documentación API – Polleria"
      subtitle="Explora la especificación OpenAPI de la aplicación."
      icon={FileText}
    />
    <section className="p-6 bg-(--color-background) min-h-screen">
      <SwaggerUI url={specUrl} />
    </section>
  </>
);
}
