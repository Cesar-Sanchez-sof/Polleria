import { EntryKpis } from "./components/EntryKpis";

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
  <EntryKpis
  initialLoading={loading && !pageData}
  total={total}
  percentage={validatedPercentage}
  from={from}
  to={to}
  />
  */
  );
}
