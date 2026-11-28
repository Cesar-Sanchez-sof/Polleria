"use client";

import { useEffect, useRef } from "react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FileText } from "lucide-react";

/**
 * Vista que expone la documentación OpenAPI mediante Swagger UI.
 * Utiliza el renderizador oficial de Swagger UI Standalone cargado de forma limpia
 * en el navegador, desacoplado de dependencias legacy de React.
 */
export default function ApiDocs() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inyectar CSS de Swagger UI
    const linkId = "swagger-ui-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
      document.head.appendChild(link);
    }

    // Inyectar bundle de Swagger UI
    const scriptId = "swagger-ui-bundle";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    function initSwagger() {
      if ((window as any).SwaggerUIBundle && containerRef.current) {
        (window as any).SwaggerUIBundle({
          url: "/api/openapi",
          domNode: containerRef.current,
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIStandalonePreset,
          ],
          layout: "BaseLayout",
        });
      }
    }

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
      script.onload = () => {
        // standalone preset
        const presetScript = document.createElement("script");
        presetScript.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js";
        presetScript.onload = initSwagger;
        document.body.appendChild(presetScript);
      };
      document.body.appendChild(script);
    } else {
      initSwagger();
    }
  }, []);

  return (
    <>
      <ModuleHeader
        title="Documentación API"
        subtitle="Explora la especificación OpenAPI de la aplicación."
        icon={FileText}
      />
      <section className="p-6 bg-(--color-background) min-h-screen">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div ref={containerRef} id="swagger-ui-container" />
        </div>
      </section>
    </>
  );
}
