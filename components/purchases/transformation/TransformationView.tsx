"use client";

import React, { useState } from "react";
import { TransformationForm } from "./TransformationForm";
import { RecipesTab } from "./RecipesTab";
import { TransformationsTable } from "./TransformationsTable";
import { TransformationRecipeItem, RecipeProductItem } from "./RecipeDialog";
import { TransformationDetailRecord } from "./TransformationDetailDialog";
import { Repeat, Sparkles, History } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

interface TransformationViewProps {
  products: RecipeProductItem[];
  recipes: TransformationRecipeItem[];
  transformations: TransformationDetailRecord[];
}

export function TransformationView({
  products,
  recipes,
  transformations,
}: TransformationViewProps) {
  const [activeTab, setActiveTab] = useState<"execute" | "recipes" | "history">("execute");

  return (
    <>
      <ModuleHeader
        title="Transformación de Insumos"
        subtitle="Define recetas de producción y ejecútalas por lote para convertir materias primas en productos terminados"
        icon={Repeat}
        iconClassName="bg-orange-100 text-orange-800"
      >
          {/* Selector de Tabs Moderno y Segmentado */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit max-w-full overflow-x-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("execute")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "execute"
                  ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Repeat className={`h-4 w-4 ${activeTab === "execute" ? "text-amber-600 dark:text-amber-400" : ""}`} />
              <span className="hidden lg:inline">Ejecutar Transformación</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("recipes")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "recipes"
                  ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Sparkles className={`h-4 w-4 ${activeTab === "recipes" ? "text-amber-600 dark:text-amber-400" : ""}`} />
              <span className="hidden lg:inline">Recetas de Producción</span>
              <span
                className={`ml-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "recipes"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50"
                    : "bg-slate-200 dark:bg-slate-800 text-muted-foreground"
                }`}
              >
                {recipes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <History className={`h-4 w-4 ${activeTab === "history" ? "text-amber-600 dark:text-amber-400" : ""}`} />
              <span className="hidden lg:inline">Historial de Lotes</span>
              <span
                className={`ml-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "history"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50"
                    : "bg-slate-200 dark:bg-slate-800 text-muted-foreground"
                }`}
              >
                {transformations.length}
              </span>
            </button>
          </div>
      </ModuleHeader>
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          {/* Contenido del Tab Activo */}
          {activeTab === "execute" && (
            <TransformationForm
              recipes={recipes}
              products={products}
              onGoToRecipesTab={() => setActiveTab("recipes")}
            />
          )}

          {activeTab === "recipes" && (
            <RecipesTab recipes={recipes} products={products} />
          )}

          {activeTab === "history" && (
            <TransformationsTable transformations={transformations} />
          )}
        </div>
      </main>
    </>
  );
}
