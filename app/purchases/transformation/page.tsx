import React from "react";
import { Repeat } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
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
    <>
      <ModuleHeader
        title="Transformación de Inventario"
        subtitle="Convierte materias primas en productos procesados o terminados"
        icon={Repeat}
        iconClassName="bg-orange-100 text-orange-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <TransformationForm supplies={JSON.parse(JSON.stringify(supplies))} />
          <TransformationsTable transformations={JSON.parse(JSON.stringify(transformations))} />
        </div>
      </main>
    </>
  );
}
