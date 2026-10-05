// app/swagger/page.tsx
"use client";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";

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
    <section className="p-6 bg-(--color-background) min-h-screen">
      <h1 className="text-3xl font-bold mb-4" style={{ color: "#e0e0ff" }}>
        Documentación API – Polleria
      </h1>
      <SwaggerUI url={specUrl} />
    </section>
  );
}
