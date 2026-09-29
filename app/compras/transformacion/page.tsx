import React from "react";
import { obtenerInsumos } from "@/lib/services/compras/insumo";
import { obtenerTransformaciones } from "@/lib/services/compras/transformacion";
import { FormularioTransformacion } from "@/components/compras/transformacion/FormularioTransformacion";
import { TablaTransformaciones } from "@/components/compras/transformacion/TablaTransformaciones";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transformación de Insumos | Compras",
};

export default async function TransformacionPage() {
  const [insumos, transformaciones] = await Promise.all([
    obtenerInsumos(),
    obtenerTransformaciones(),
  ]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transformación de Inventario (Mini-Producción)</h1>
        <p className="text-sm text-muted-foreground">
          Transforma materias primas (ej: pollo entero) en productos procesados o terminados (ej: pollo trozado, pechugas deshuesadas).
        </p>
      </div>

      <FormularioTransformacion insumos={JSON.parse(JSON.stringify(insumos))} />

      <TablaTransformaciones transformaciones={JSON.parse(JSON.stringify(transformaciones))} />
    </div>
  );
}
