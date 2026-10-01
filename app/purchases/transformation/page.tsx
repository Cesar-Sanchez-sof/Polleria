import React from "react";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getTransformations } from "@/lib/services/purchases/transformation";
import { TransformationForm } from "@/components/purchases/transformation/TransformationForm";
import { TransformationsTable } from "@/components/purchases/transformation/TransformationsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supply Transformation | Purchases",
};

export default async function TransformationPage() {
  const [supplies, transformations] = await Promise.all([
    getSupplies(),
    getTransformations(),
  ]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transformación de Inventario (Mini-Producción)</h1>
        <p className="text-sm text-muted-foreground">
          Transforma materias primas (ej: pollo entero) en productos procesados o terminados (ej: pollo trozado, pechugas deshuesadas).
        </p>
      </div>

      <TransformationForm supplies={JSON.parse(JSON.stringify(supplies))} />

      <TransformationsTable transformations={JSON.parse(JSON.stringify(transformations))} />
    </div>
  );
}
