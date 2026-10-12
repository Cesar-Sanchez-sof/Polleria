import React from "react";
import { Repeat } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSupplies } from "@/lib/services/purchases/supply";
import {
  getTransformationRecipes,
  getTransformations,
} from "@/lib/services/purchases/transformation";
import { TransformationView } from "@/components/purchases/transformation/TransformationView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transformación de Insumos | Compras",
};

export default async function TransformationPage() {
  const [supplies, recipes, transformations] = await Promise.all([
    getSupplies(),
    getTransformationRecipes(),
    getTransformations(),
  ]);

  return (
    <>
      <ModuleHeader
        title="Transformación de Insumos"
        subtitle="Define recetas de producción y ejecútalas por lote para convertir materias primas en productos terminados"
        icon={Repeat}
        iconClassName="bg-orange-100 text-orange-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <TransformationView
            supplies={JSON.parse(JSON.stringify(supplies))}
            recipes={JSON.parse(JSON.stringify(recipes))}
            transformations={JSON.parse(JSON.stringify(transformations))}
          />
        </div>
      </main>
    </>
  );
}
