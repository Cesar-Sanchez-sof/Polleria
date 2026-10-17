import { DocPage, Panel, Section } from "@/components/style-guide/doc-kit";

interface ColorMeaning {
  name: string;
  /** Classes of the sample chip. */
  chip: string;
  /** Classes of the solid dot / button sample. */
  solid: string;
  meaning: string;
  uses: readonly string[];
}

const COLORS: readonly ColorMeaning[] = [
  {
    name: "Rojo",
    chip: "border-red-200 bg-red-50 text-red-800",
    solid: "bg-red-700",
    meaning: "Marca, acción principal y alerta.",
    uses: [
      "Botón principal de cada pantalla: Nuevo, Agregar producto, Crear.",
      "Marca del ERP: iconos de módulo, pestaña activa, códigos de cuenta.",
      "Peligro o pendiente de atender: Eliminar, Cancelar, vencido, mesa ocupada.",
    ],
  },
  {
    name: "Verde",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    solid: "bg-emerald-600",
    meaning: "Éxito, disponible y dinero cobrado.",
    uses: [
      "Estados finales correctos: Activo, Pagado, Cancelado (deuda saldada), Abierto, Completado.",
      "Disponibilidad: mesa libre, producto con stock.",
      "Acciones de cobro: Cobrar en mesa, Pagar, total amortizado.",
    ],
  },
  {
    name: "Azul",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    solid: "bg-blue-600",
    meaning: "Información y estado en proceso.",
    uses: [
      "Primer estado de un flujo: Recibido, pedido nuevo.",
      "Acciones de consulta: Ver, Detalle, Ver cambios, enlaces.",
      "Estado intermedio: Amortización parcial, aforo, datos informativos.",
    ],
  },
  {
    name: "Amarillo (ámbar)",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    solid: "bg-amber-500",
    meaning: "En curso, atención o pausa.",
    uses: [
      "Trabajo en marcha: En preparación, Preparando.",
      "Pausado o en espera: producto Pausado, pendiente de revisión.",
      "Acciones de edición (lápiz) y pedidos Para llevar.",
    ],
  },
  {
    name: "Morado",
    chip: "border-purple-200 bg-purple-50 text-purple-800",
    solid: "bg-purple-600",
    meaning: "Listo para servir: la cocina terminó y espera al mozo.",
    uses: [
      "Estado «Listo para servir» en el KDS, en las mesas y en Pedidos Listos.",
      "Botón «Avanzar → Listo para servir» de la cocina.",
      "Lo que ve el mozo como pendiente de llevar a la mesa.",
    ],
  },
  {
    name: "Cyan",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800",
    solid: "bg-cyan-600",
    meaning: "Servido: el mozo ya entregó el pedido en la mesa.",
    uses: [
      "Estado «Servido» de las comandas, en el KDS y en las mesas.",
      "Se marca desde Pedidos Listos con «Marcar como Entregado».",
      "No se usa para éxito general: eso es verde.",
    ],
  },
];

const FLOW = [
  { label: "Recibido", chip: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-600" },
  { label: "Preparando", chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  { label: "Listo para servir", chip: "border-purple-200 bg-purple-50 text-purple-800", dot: "bg-purple-600" },
  { label: "Servido", chip: "border-cyan-200 bg-cyan-50 text-cyan-800", dot: "bg-cyan-600" },
  { label: "Cobrado", chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-600" },
] as const;

export default function ColorsPage() {
  return (
    <DocPage
      title="Colores"
      category="Fundamentos"
      description="Qué significa cada color en el ERP. Úsalos siempre con el mismo sentido para que el personal reconozca un estado a simple vista."
    >
      <Section title="Significado de los colores" description="Rojo, verde, azul, amarillo, morado y cyan: cada uno comunica una cosa distinta.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {COLORS.map((color) => (
            <Panel key={color.name}>
              <div className="mb-3 flex items-center gap-3">
                <span className={`size-9 shrink-0 rounded-xl ${color.solid}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-foreground">{color.name}</p>
                  <p className="text-xs text-muted-foreground">{color.meaning}</p>
                </div>
              </div>
              <span className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${color.chip}`}>
                <span className={`size-1.5 rounded-full ${color.solid}`} />
                {color.name}
              </span>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                {color.uses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="Ejemplo: recorrido de una comanda" description="Los colores siguen el avance del pedido, de la cocina a la mesa y al cobro.">
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((step, index) => (
            <div key={step.label} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${step.chip}`}>
                <span className={`size-2 rounded-full ${step.dot}`} />
                {step.label}
              </span>
              {index < FLOW.length - 1 ? <span className="text-muted-foreground">→</span> : null}
            </div>
          ))}
        </div>
      </Section>
    </DocPage>
  );
}
