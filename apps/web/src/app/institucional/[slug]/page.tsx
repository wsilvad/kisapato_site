import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { loadSettings } from "@/lib/site-settings";
import type { SiteSettings } from "@/types/product";

export const dynamic = "force-dynamic";

async function getPage(slug: string) {
  const settings = await loadSettings();
  const page = (settings.pages ?? []).find((p) => p.slug === slug && p.body.trim());
  return page ? { page, settings } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await getPage((await params).slug);
  return { title: found?.page.title ?? "Institucional" };
}

/** Texto da página: parágrafos separados por linha em branco; "## " vira subtítulo e linhas com "- " viram lista. */
function RichText({ body }: { body: string }) {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((block, i) => {
      const text = block.trim();
      if (text.startsWith("## ")) return <h2 key={i}>{text.slice(3)}</h2>;
      const lines = text.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- "))) {
        return (
          <ul key={i}>
            {lines.map((l) => (
              <li key={l}>{l.slice(2)}</li>
            ))}
          </ul>
        );
      }
      return <p key={i}>{lines.join(" ")}</p>;
    });
}

/** Valores e prazos de entrega lidos da tabela de frete do painel, para a política nunca ficar desatualizada. */
function ShippingTable({ shipping }: { shipping: SiteSettings["shipping"] }) {
  if (shipping.regions.length === 0) return null;
  return (
    <>
      <h2>Valores e prazos por região</h2>
      <table className="inst-table">
        <thead>
          <tr>
            <th>Região</th>
            <th>Frete</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {shipping.regions.map((r) => (
            <tr key={r.name}>
              <td>
                {r.name}
                <small>{r.states.join(", ")}</small>
              </td>
              <td>{formatPrice(r.price)}</td>
              <td>
                {r.minDays === r.maxDays ? r.maxDays : `${r.minDays} a ${r.maxDays}`} dias úteis
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shipping.freeAbove > 0 && <p>Frete grátis para compras a partir de {formatPrice(shipping.freeAbove)}.</p>}
      {shipping.pickup.active && (
        <p>
          {shipping.pickup.label}: sem custo.{shipping.pickup.note ? ` ${shipping.pickup.note}` : ""}
        </p>
      )}
    </>
  );
}

/** Páginas institucionais (Quem somos, Trocas e devoluções, Políticas de entrega…), escritas no painel. */
export default async function InstitucionalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getPage(slug);
  if (!found) notFound();
  const { page, settings } = found;
  const others = settings.pages.filter((p) => p.slug !== slug && p.body.trim());

  return (
    <div className="page inst">
      <nav className="inst-crumbs" aria-label="Você está em">
        <Link href="/">Início</Link> / <span>Institucional</span>
      </nav>
      <h1 className="page-title">{page.title}</h1>
      <div className="inst-body">
        <RichText body={page.body} />
        {slug === "politicas-de-entrega" && <ShippingTable shipping={settings.shipping} />}
      </div>
      {others.length > 0 && (
        <aside className="inst-more">
          <h2>Veja também</h2>
          <ul>
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={`/institucional/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
