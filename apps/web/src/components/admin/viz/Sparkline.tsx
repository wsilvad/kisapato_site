/** Miniatura de tendência para os cartões de indicador: linha de 2px e ponto final com anel da cor da superfície. */
export function Sparkline({ values, color = "var(--viz-s1)" }: { values: number[]; color?: string }) {
  const W = 96;
  const H = 28;
  const pad = 4;
  const max = Math.max(...values, 0);
  if (values.length < 2 || max <= 0) return <svg className="spark" width={W} height={H} aria-hidden="true"><line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--viz-grid)" strokeWidth="2" strokeLinecap="round" /></svg>;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (values.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg className="spark" width={W} height={H} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="3.5" fill={color} stroke="var(--viz-surface)" strokeWidth="2" />
    </svg>
  );
}
