import { KpisAsientos } from "./KpisAsientos";

export default function Balance() {
  return (
    <iframe
      src="/balance.html"
      title="Página de ventas"
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
      }}
    />
/*
  <KpisAsientos
  cargandoInicial={cargando && !pagina}
  total={total}
  porcentaje={porcentajeValidados}
  desde={desde}
  hasta={hasta}
  />
  */
  );
}
