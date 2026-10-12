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
      {/* Selector de Tabs */}
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("execute")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === "execute"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Repeat className="h-4 w-4" />
          Ejecutar Transformación
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === "recipes"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Recetas de Producción
          <span className="ml-1 text-[10px] bg-background/20 px-1.5 py-0.2 rounded-full">
            {recipes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Historial de Lotes
          <span className="ml-1 text-[10px] bg-background/20 px-1.5 py-0.2 rounded-full">
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
