/**
 * Resumo semanal das métricas do site em Markdown (só dados; uma IA pode transformá-lo em texto corrido, ver docs/analytics/AGENTS.md).
 *   npm run analytics:report -w @ki-sapato/api -- [--days 7] [--out relatorio.md]
 * Lê só as views bi.v1_*. Compara o período com o anterior de mesmo tamanho.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const arg = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const days = Math.max(1, Math.min(90, Number(arg("days") ?? 7)));
const outFile = arg("out");

type Row = Record<string, unknown>;
const q = async (sql: string): Promise<Row[]> => {
  const rows = await prisma.$queryRawUnsafe<Row[]>(sql);
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v !== null && typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : v])));
};
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const fmt = (v: unknown, d = 0) => n(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = (v: unknown) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => (b > 0 ? `${fmt((100 * a) / b, 1)}%` : "—");
const delta = (cur: number, prev: number) => (prev > 0 ? `${cur >= prev ? "+" : ""}${fmt((100 * (cur - prev)) / prev, 0)}%` : "novo");
const table = (head: string[], rows: string[][]) => (rows.length ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") : "_Sem dados no período._");

const cur = `date_sp > current_date - ${days} AND date_sp <= current_date`;
const prev = `date_sp > current_date - ${2 * days} AND date_sp <= current_date - ${days}`;
const traffic = async (where: string) => (await q(`SELECT coalesce(sum(sessions),0) AS sessions, coalesce(sum(page_views),0) AS pv, coalesce(sum(bounced_sessions),0) AS bounced, coalesce(sum(sessions_with_issues),0) AS issues FROM bi.v1_traffic_daily WHERE ${where}`))[0]!;
const sales = async (where: string) => (await q(`SELECT count(DISTINCT order_id) AS orders, coalesce(sum(line_revenue),0) AS revenue FROM bi.v1_sales WHERE status <> 'CANCELED' AND ${where}`))[0]!;

const [tc, tp, sc, sp] = [await traffic(cur), await traffic(prev), await sales(cur), await sales(prev)];
const funnel = await q(`SELECT step_order, step, sum(sessions) AS sessions FROM bi.v1_funnel WHERE ${cur} GROUP BY 1, 2 ORDER BY 1`);
const pages = await q(`SELECT path, sum(page_views) AS v FROM bi.v1_page_ranking WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 5`);
const clicked = await q(`SELECT product_name, sum(clicks) AS c, sum(impressions) AS i FROM bi.v1_product_engagement WHERE ${cur} GROUP BY 1 HAVING sum(clicks) > 0 ORDER BY 2 DESC LIMIT 5`);
const favs = await q(`SELECT product_name, sum(fav_net) AS f FROM bi.v1_product_engagement WHERE ${cur} GROUP BY 1 HAVING sum(fav_net) > 0 ORDER BY 2 DESC LIMIT 5`);
const searches = await q(`SELECT search_term, sum(searches) AS s, sum(zero_result_searches) AS z FROM bi.v1_search_terms WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 5`);
const zero = await q(`SELECT search_term, sum(zero_result_searches) AS z FROM bi.v1_search_terms WHERE ${cur} GROUP BY 1 HAVING sum(zero_result_searches) > 0 ORDER BY 2 DESC LIMIT 5`);
const carts = (await q("SELECT count(*) AS c, coalesce(sum(cart_value),0) AS v, count(*) FILTER (WHERE stage = 'checkout') AS co FROM bi.v1_abandoned_carts"))[0]!;
const cartItems = await q("SELECT item_name, count(*) AS c, sum(line_value) AS v FROM bi.v1_cart_items WHERE abandoned GROUP BY 1 ORDER BY 3 DESC LIMIT 5");
const issues = await q(`SELECT path, sum(page_views) AS pv, sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) AS p, max(lcp_p75_ms) AS lcp, max(lcp_rating) AS r FROM bi.v1_experience_issues WHERE ${cur} GROUP BY 1 HAVING sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) > 0 ORDER BY 3 DESC LIMIT 5`);
const apiErr = await q(`SELECT endpoint, error_code, sum(occurrences) AS o FROM bi.v1_api_errors WHERE ${cur} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5`);
const score = await q("SELECT product_name, category, score, enough_data FROM bi.v1_product_scorecard ORDER BY score DESC LIMIT 5");
const gems = await q("SELECT product_name, views, orders FROM bi.v1_product_scorecard WHERE hidden_gem ORDER BY conversion_rate DESC LIMIT 5");
const price = await q("SELECT product_name, views, fav_adds, orders, max_discount_pct, cost_known FROM bi.v1_price_opportunity ORDER BY views DESC LIMIT 5");

const s = n(tc.sessions);
const notes: string[] = [];
if (n(tp.sessions) > 0 && s < 0.8 * n(tp.sessions)) notes.push(`Visitas caíram ${delta(s, n(tp.sessions))} em relação ao período anterior.`);
if (s > 0 && n(tc.issues) / s > 0.1) notes.push(`${pct(n(tc.issues), s)} das visitas tiveram algum problema (erro, cliques repetidos, 404 ou imagem quebrada).`);
if (s > 0 && n(tc.bounced) / s > 0.6) notes.push(`Rejeição alta: ${pct(n(tc.bounced), s)} das visitas saíram sem ver produto nem usar a sacola.`);
if (n(carts.c) > 0) notes.push(`${fmt(carts.c)} carrinhos abandonados somam ${brl(carts.v)}; ${fmt(carts.co)} chegaram ao checkout.`);
if (zero.length > 0) notes.push(`Buscas sem resultado: ${zero.map((z) => `“${z.search_term}”`).join(", ")}.`);
if (gems.length > 0) notes.push(`Joias escondidas para ganhar destaque: ${gems.map((g) => String(g.product_name)).join(", ")}.`);

const md = [
  `# Resumo semanal das métricas (últimos ${days} dias)`,
  `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Fonte: views bi.v1_* (fuso de Brasília). Compara com os ${days} dias anteriores.`,
  "## Em poucas palavras\n" + (notes.length ? notes.map((x) => `- ${x}`).join("\n") : "- Nada fora do normal nas regras automáticas."),
  "## Visão geral\n" + table(["Indicador", "Período", "Anterior", "Variação"], [
    ["Visitas", fmt(tc.sessions), fmt(tp.sessions), delta(s, n(tp.sessions))],
    ["Páginas por visita", fmt(s > 0 ? n(tc.pv) / s : 0, 2), fmt(n(tp.sessions) > 0 ? n(tp.pv) / n(tp.sessions) : 0, 2), "—"],
    ["Rejeição", pct(n(tc.bounced), s), pct(n(tp.bounced), n(tp.sessions)), "—"],
    ["Pedidos", fmt(sc.orders), fmt(sp.orders), delta(n(sc.orders), n(sp.orders))],
    ["Receita", brl(sc.revenue), brl(sp.revenue), delta(n(sc.revenue), n(sp.revenue))],
    ["Conversão (pedidos ÷ visitas)", pct(n(sc.orders), s), pct(n(sp.orders), n(tp.sessions)), "—"],
  ]),
  "## Funil\n" + table(["Etapa", "Visitas", "% das visitas"], funnel.map((f) => [String(f.step), fmt(f.sessions), pct(n(f.sessions), n(funnel[0]?.sessions))])),
  "## O que mais acessam\n" + table(["Página", "Vistas"], pages.map((p) => [`\`${String(p.path)}\``, fmt(p.v)])),
  "## Produtos mais clicados\n" + table(["Produto", "Cliques", "CTR"], clicked.map((p) => [String(p.product_name), fmt(p.c), pct(n(p.c), n(p.i))])),
  "## Mais favoritados\n" + table(["Produto", "Saldo de favoritos"], favs.map((p) => [String(p.product_name), fmt(p.f)])),
  "## Buscas\n" + table(["Termo", "Buscas", "Sem resultado"], searches.map((p) => [String(p.search_term), fmt(p.s), fmt(p.z)])),
  "## Carrinhos\n" + `${fmt(carts.c)} abandonados · ${brl(carts.v)} parados · ${fmt(carts.co)} chegaram ao checkout.\n\n` + table(["Item mais abandonado", "Sacolas", "Valor"], cartItems.map((p) => [String(p.item_name), fmt(p.c), brl(p.v)])),
  "## Qualidade da experiência\n" + table(["Página", "Vistas", "Problemas", "LCP p75 (ms)", "Nota"], issues.map((p) => [`\`${String(p.path)}\``, fmt(p.pv), fmt(p.p), p.lcp === null ? "—" : fmt(p.lcp), String(p.r ?? "—")])) + "\n\n" + table(["Rota da API", "Código", "Vezes"], apiErr.map((p) => [`\`${String(p.endpoint)}\``, String(p.error_code), fmt(p.o)])),
  "## Destaques\n" + table(["Produto", "Categoria", "Índice", "Amostra ok"], score.map((p) => [String(p.product_name), String(p.category), fmt(p.score, 1), p.enough_data ? "sim" : "não"])) + "\n\n**Joias escondidas** (convertem bem, aparecem pouco)\n\n" + table(["Produto", "Vistas", "Pedidos"], gems.map((p) => [String(p.product_name), fmt(p.views), fmt(p.orders)])),
  "## Oportunidades de preço\n" + table(["Produto", "Vistas", "Favoritos", "Pedidos", "Desconto máx. (%)"], price.map((p) => [String(p.product_name), fmt(p.views), fmt(p.fav_adds), fmt(p.orders), p.cost_known ? fmt(p.max_discount_pct, 1) : "custo desconhecido"])) + "\n\n_Sinal para investigar, não prova de que o preço é o motivo (frete, estoque e foto também pesam)._",
].join("\n\n") + "\n";

if (outFile) {
  writeFileSync(outFile, md);
  console.log(`Relatório gravado em ${outFile}`);
} else {
  process.stdout.write(md);
}
await prisma.$disconnect();
