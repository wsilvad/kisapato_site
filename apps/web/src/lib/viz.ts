"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyPoint } from "@/types/product";

/** Métricas que o gráfico principal sabe mostrar. */
export type MetricKey = "profit" | "revenue" | "orders" | "ticket" | "items";

export interface Bin {
  from: string;
  to: string;
  revenue: number;
  orders: number;
  items: number;
  profit: number;
}

/** Junta dias consecutivos em blocos de `size` dias, a partir do primeiro (assim o período anterior alinha bloco a bloco). */
export function binDaily(daily: DailyPoint[], size: number): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const chunk = daily.slice(i, i + size);
    bins.push({
      from: chunk[0]!.date,
      to: chunk.at(-1)!.date,
      revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      orders: chunk.reduce((s, d) => s + d.orders, 0),
      items: chunk.reduce((s, d) => s + d.items, 0),
      profit: chunk.reduce((s, d) => s + d.profit, 0),
    });
  }
  return bins;
}

export function metricOf(bin: { revenue: number; orders: number; items: number; profit: number }, metric: MetricKey): number {
  return metric === "ticket" ? (bin.orders > 0 ? bin.revenue / bin.orders : 0) : bin[metric];
}

/** 1.234 → "1,2 mil"; 2.500.000 → "2,5 mi"; abaixo de mil, o número inteiro. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
  if (abs >= 1_000_000) return `${fmt(n / 1_000_000)} mi`;
  if (abs >= 1_000) return `${fmt(n / 1_000)} mil`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

/** Teto "redondo" e marcas do eixo (0, 1.000, 2.000…) para um máximo qualquer. */
export function niceTicks(maxValue: number, target = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const raw = maxValue / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v < maxValue + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: ticks.at(-1)!, ticks };
}

/** Largura atual de um elemento (acompanha o redimensionamento), para gráficos SVG responsivos. */
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width) || initial);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [initial]);
  return [ref, width];
}

const WEEKDAY_SHORT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
/** "2026-10-14" → "qua, 14/10". Sem passar por fuso (o dia já está em horário de Brasília). */
export function dayLabel(key: string, withWeekday = true): string {
  const [, m, d] = key.split("-");
  const date = new Date(`${key}T12:00:00Z`);
  const weekday = WEEKDAY_SHORT[(date.getUTCDay() + 6) % 7];
  return `${withWeekday ? `${weekday}, ` : ""}${d}/${m}`;
}

export { WEEKDAY_SHORT };
