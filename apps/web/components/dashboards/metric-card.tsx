export function MetricCard({
  label,
  value,
  note,
  tone = "paper",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "paper" | "navy" | "signal";
}) {
  const toneClass = tone === "navy" ? " metric-card-dark" : tone === "signal" ? " metric-card-signal" : "";
  return (
    <article className={`metric-card${toneClass}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
