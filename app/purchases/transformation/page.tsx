import React from "react";
import { getProducts } from "@/lib/services/purchases/product";
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
  const [products, recipes, transformations] = await Promise.all([
    getProducts(),
    getTransformationRecipes(),
    getTransformations(),
  ]);

  return (
    <TransformationView
      products={JSON.parse(JSON.stringify(products))}
      recipes={JSON.parse(JSON.stringify(recipes))}
      transformations={JSON.parse(JSON.stringify(transformations))}
    />
  );
}
