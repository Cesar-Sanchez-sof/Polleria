"use client";

import React, { useState } from "react";
import { TransformationForm } from "./TransformationForm";
import { RecipesTab } from "./RecipesTab";
import { TransformationsTable } from "./TransformationsTable";
import { TransformationRecipeItem, RecipeSupplyItem } from "./RecipeDialog";
import { TransformationDetailRecord } from "./TransformationDetailDialog";
import { Repeat, Sparkles, History } from "lucide-react";

interface TransformationViewProps {
  supplies: RecipeSupplyItem[];
  recipes: TransformationRecipeItem[];
  transformations: TransformationDetailRecord[];
}

export function TransformationView({
  supplies,
  recipes,
  transformations,
}: TransformationViewProps) {
  const [activeTab, setActiveTab] = useState<"execute" | "recipes" | "history">("execute");

  return (
    <div className="space-y-5">
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
          <span>Ejecutar Transformación</span>
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
          <span>Recetas de Producción</span>
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
          <span>Historial de Lotes</span>
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

      {/* Contenido del Tab Activo */}
      {activeTab === "execute" && (
        <TransformationForm
          recipes={recipes}
          supplies={supplies}
          onGoToRecipesTab={() => setActiveTab("recipes")}
        />
      )}

      {activeTab === "recipes" && (
        <RecipesTab recipes={recipes} supplies={supplies} />
      )}

      {activeTab === "history" && (
        <TransformationsTable transformations={transformations} />
      )}
    </div>
  );
}
