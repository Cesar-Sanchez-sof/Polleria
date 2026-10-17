"use client";

import { useState } from "react";
import { StatusBadge, type StatusBadgeSize, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { DocPage, Section, Panel, Toggle, Choice, CodeBlock, PropsTable, TextField, type PropDoc, UsedByViews } from "@/components/style-guide/doc-kit";

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE_PROPS: readonly PropDoc[] = [
  { name: "tone", type: "\"success\" | \"danger\" | \"warning\" | \"info\" | \"neutral\"", default: "\"neutral\"", description: "Color del estado." },
  { name: "size", type: "\"sm\" | \"md\"", default: "\"md\"", description: "Tamaño de la píldora." },
  { name: "enableDot", type: "boolean", default: "true", description: "Muestra el punto de color antes del texto." },
  { name: "pulse", type: "boolean", default: "false", description: "Anima el punto (estados recientes o en vivo)." },
  { name: "detail", type: "ReactNode", description: "Línea secundaria bajo la píldora (p. ej. «Resta S/ 40.00»)." },
];

function BadgeSection() {
  const [tone, setTone] = useState<StatusBadgeTone>("success");
  const [size, setSize] = useState<StatusBadgeSize>("md");
  const [enableDot, setEnableDot] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [detail, setDetail] = useState(false);
  const [text, setText] = useState("Pagado");
  const [detailText, setDetailText] = useState("Resta S/ 40.00");
  const [extraClass, setExtraClass] = useState("");

  const code = `<StatusBadge tone="${tone}"${size === "md" ? "" : ` size="${size}"`}${enableDot ? "" : " enableDot={false}"}${pulse ? " pulse" : ""}${detail ? ` detail="${detailText}"` : ""}${extraClass ? ` className="${extraClass}"` : ""}>
  ${text}
</StatusBadge>`;

  return (
    <Section title="Badge de estado" description="Píldora de estado usada en la columna «Estado de pago» de la tabla de compras.">
      <Panel title="Vista previa">
        <div className="flex min-h-12 items-center gap-6">
          <StatusBadge tone={tone} size={size} enableDot={enableDot} pulse={pulse} detail={detail ? detailText : undefined} className={extraClass || undefined}>
            {text}
          </StatusBadge>
          <div className="flex flex-wrap gap-2">
            {(["success", "warning", "danger", "info", "neutral"] as const).map((value) => (
              <StatusBadge key={value} tone={value} size="sm">
                {value}
              </StatusBadge>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Parámetros">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Choice label="tone" value={tone} options={["success", "danger", "warning", "info", "neutral"] as const} onChange={setTone} />
          <Choice label="size" value={size} options={["sm", "md"] as const} onChange={setSize} />
          <Toggle label="enableDot" checked={enableDot} onChange={setEnableDot} />
          <Toggle label="pulse" checked={pulse} onChange={setPulse} />
          <Toggle label="detail" checked={detail} onChange={setDetail} />
          <TextField label="children" value={text} onChange={setText} width="w-28" />
          <TextField label="detail (texto)" value={detailText} onChange={setDetailText} width="w-32" />
          <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
        </div>
      </Panel>
      <CodeBlock code={code} />
      <PropsTable docs={BADGE_PROPS} />
    </Section>
  );
}

export default function StatusBadgePage() {
  return (
    <DocPage title="Badge de estado" category="Visualización" description="Píldora de estado con punto de color, tamaños, animación y línea de detalle. Es la que usa la columna «Estado de pago» de Compras.">
      <BadgeSection />
      <UsedByViews component="status-badge" />
    </DocPage>
  );
}
