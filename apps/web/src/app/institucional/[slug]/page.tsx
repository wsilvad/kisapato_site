import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialLinks } from "@/components/SocialLinks";
import { assetUrl } from "@/lib/api";
import { cropVarsOf } from "@/lib/crop";
import { formatPrice } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import { groupForLayout, mobileCropOf, parsePageBody, toAboutLayout, type LayoutItem, type PageBlock, type PagePhoto } from "@/lib/page-body";
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

/**
 * Foto da página, com a largura, a proporção do corte e o enquadramento (foco e zoom, como nas campanhas: um para o computador
 * e outro para o celular) escolhidos no painel. `defaultRatio` vale quando a proporção é "auto".
 */
function Photo({ photo, className, defaultRatio }: { photo: PagePhoto; className: string; defaultRatio?: string }) {
  const chosen = photo.r !== "auto" && photo.r !== "natural" ? photo.r.replace(":", " / ") : undefined;
  const ratio = chosen ?? (photo.r === "auto" ? defaultRatio : undefined);
  const classes = ["page-img", className, `is-w-${photo.w}`, ratio && "has-ratio", photo.r === "natural" && "is-natural"].filter(Boolean).join(" ");
  const style = { ...cropVarsOf(photo.crop, mobileCropOf(photo)), ...(ratio && { "--ratio": ratio }) } as React.CSSProperties;
  return (
    <figure className={classes} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel */}
      <img src={assetUrl(photo.src)} alt={photo.alt} loading="lazy" />
    </figure>
  );
}

function TextBlock({ block, className }: { block: Extract<PageBlock, { kind: "p" | "ul" }>; className?: string }) {
  if (block.kind === "ul") {
    return (
      <ul className={className}>
        {block.items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    );
  }
  return <p className={className}>{block.text}</p>;
}

/** Texto das páginas comuns (Trocas, Entrega…): parágrafos, subtítulos, listas, fotos, grupos de fotos e foto ao lado do texto. */
function RichText({ body }: { body: string }) {
  return groupForLayout(parsePageBody(body)).map((item, i) => {
    switch (item.kind) {
      case "h2":
        return <h2 key={i}>{item.eyebrow ? `${item.eyebrow}: ${item.title}` : item.title}</h2>;
      case "img":
        return <Photo key={i} photo={item} className="inst-figure" />;
      case "gallery":
        return (
          <div key={i} className="photo-row" style={{ "--cols": item.photos.length } as React.CSSProperties}>
            {item.photos.map((p, j) => <Photo key={j} photo={p} className="photo-row-item" defaultRatio="4 / 5" />)}
          </div>
        );
      case "split":
        return (
          <div key={i} className={`inst-split is-${item.photo.lado}`}>
            <Photo photo={item.photo} className="inst-split-photo" defaultRatio="4 / 5" />
            <div>{item.texts.map((t, j) => <TextBlock key={j} block={t} />)}</div>
          </div>
        );
      default:
        return <TextBlock key={i} block={item} />;
    }
  });
}

/** Itens de uma seção da página “Sobre”: texto centralizado, fotos em largura total, grupos lado a lado e foto na lateral. */
function AboutItems({ items, heading }: { items: LayoutItem[]; heading?: React.ReactNode }) {
  return items.map((item, i) => {
    switch (item.kind) {
      case "img":
        return <Photo key={i} photo={item} className="sobre-figure" />;
      case "gallery":
        return (
          <div key={i} className="photo-row sobre-row" style={{ "--cols": item.photos.length } as React.CSSProperties}>
            {item.photos.map((p, j) => <Photo key={j} photo={p} className="photo-row-item" defaultRatio="4 / 5" />)}
          </div>
        );
      case "split":
        // foto de um lado, texto do outro; na primeira foto da seção, o rótulo e o título vão junto do texto
        return (
          <div key={i} className={`sobre-split is-${item.photo.lado}`}>
            <Photo photo={item.photo} className="sobre-split-photo" defaultRatio="4 / 5" />
            <div className="sobre-split-text">
              {i === 0 && heading}
              {item.texts.map((t, j) => <TextBlock key={j} block={t} className="sobre-split-p" />)}
            </div>
          </div>
        );
      case "h2":
        return null;
      default:
        return <TextBlock key={i} block={item} className={item.kind === "ul" ? "sobre-p sobre-list" : "sobre-p"} />;
    }
  });
}

/**
 * Página “Sobre” em formato editorial (inspirada na Luz da Lua): foto grande no topo, frase de destaque e
 * seções com rótulo, título, texto, fotos na lateral e grupos de fotos lado a lado. Tudo vem do texto da página no painel.
 */
function AboutPage({ title, body, others }: { title: string; body: string; others: SiteSettings["pages"] }) {
  const { hero, lead, intro, sections } = toAboutLayout(parsePageBody(body));
  return (
    <div className="sobre">
      {hero && <Photo photo={hero} className="sobre-hero" />}
      <header className="sobre-head">
        <h1 className="sobre-kicker">{title}</h1>
        {lead && <p className="sobre-lead">{lead}</p>}
      </header>
      {intro.length > 0 && (
        <section className="sobre-section">
          <AboutItems items={groupForLayout(intro)} />
        </section>
      )}
      {sections.map((s) => {
        const items = groupForLayout(s.blocks);
        const heading = (
          <>
            {s.eyebrow && <span className="sobre-eyebrow">{s.eyebrow}</span>}
            <h2 className="sobre-title">{s.title}</h2>
          </>
        );
        const headingInSplit = items[0]?.kind === "split";
        return (
          <section key={s.id} id={s.id} className={`sobre-section${headingInSplit ? " has-split" : ""}`}>
            {!headingInSplit && heading}
            <AboutItems items={items} heading={heading} />
          </section>
        );
      })}
      {others.length > 0 && (
        <aside className="inst-more sobre-more">
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

/** Perguntas frequentes: cada "## Pergunta" do texto vira um item suspenso e o que vem depois dela é a resposta. */
function Faq({ body }: { body: string }) {
  const groups: { question: string; answer: PageBlock[] }[] = [];
  const intro: PageBlock[] = [];
  for (const block of parsePageBody(body)) {
    if (block.kind === "h2") groups.push({ question: block.eyebrow ? `${block.eyebrow}: ${block.title}` : block.title, answer: [] });
    else if (groups.length === 0) intro.push(block);
    else groups.at(-1)!.answer.push(block);
  }
  return (
    <>
      {intro.map((b, i) => (b.kind === "p" || b.kind === "ul" ? <TextBlock key={i} block={b} /> : null))}
      <div className="pdp-acc faq">
        {groups.map((g) => (
          <details key={g.question} className="pdp-acc-item">
            <summary>{g.question}</summary>
            <div className="pdp-acc-body">{g.answer.map((b, i) => (b.kind === "p" || b.kind === "ul" ? <TextBlock key={i} block={b} /> : null))}</div>
          </details>
        ))}
      </div>
    </>
  );
}

/**
 * Dados da loja (os mesmos do rodapé, editados em Textos e menu → Rodapé) para Fale conosco e Nossas lojas: telefone com
 * botão do WhatsApp e, em Nossas lojas, o mapa do Google marcado no endereço.
 */
function StoreInfo({ footer, social, withMap }: { footer: SiteSettings["footer"]; social: SiteSettings["social"]; withMap?: boolean }) {
  const wa = whatsappUrl(footer.whatsapp, "Olá! Vim pelo site da Ki Sapato.");
  const tel = footer.phone.replace(/\D/g, "");
  const coords = (footer.mapCoords ?? "").replace(/\s+/g, "");
  const hasMap = withMap && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(coords);
  const hasSocial = Object.values(social).some(Boolean);
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (footer.address) rows.push({ label: "Endereço", value: footer.address });
  if (footer.phone) rows.push({ label: wa ? "Telefone e WhatsApp" : "Telefone", value: tel.length >= 10 ? <a href={`tel:+55${tel.slice(-11)}`}>{footer.phone}</a> : footer.phone });
  if (footer.hours) rows.push({ label: "Atendimento", value: footer.hours });
  if (footer.cnpj) rows.push({ label: "CNPJ", value: footer.cnpj });
  if (rows.length === 0 && !hasSocial && !wa && !hasMap) return null;
  return (
    <section className="store-info">
      {rows.length > 0 && (
        <dl>
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {wa && (
        <a className="btn btn-solid btn-sm store-info-wa" href={wa} target="_blank" rel="noopener noreferrer">Conversar pelo WhatsApp</a>
      )}
      {hasMap && (
        <div className="store-map">
          <iframe
            title={`Mapa: ${footer.address || "Ki Sapato"}`}
            src={`https://www.google.com/maps?q=${coords}&z=17&hl=pt-BR&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a href={`https://www.google.com/maps/search/?api=1&query=${coords}`} target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a>
        </div>
      )}
      {hasSocial && (
        <div className="store-info-social">
          <h2>Redes sociais</h2>
          <SocialLinks social={social} className="footer-social" />
        </div>
      )}
    </section>
  );
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

/** Páginas institucionais (Sobre a Ki Sapato, Trocas e devoluções, Políticas de entrega…), escritas no painel. */
export default async function InstitucionalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getPage(slug);
  if (!found) notFound();
  const { page, settings } = found;
  const others = settings.pages.filter((p) => p.slug !== slug && p.body.trim());

  if (slug === "quem-somos") return <AboutPage title={page.title} body={page.body} others={others} />;

  return (
    <div className="page inst">
      <nav className="inst-crumbs" aria-label="Você está em">
        <Link href="/">Início</Link> / <span>Institucional</span>
      </nav>
      <h1 className="page-title">{page.title}</h1>
      <div className="inst-body">
        {slug === "perguntas-frequentes" ? <Faq body={page.body} /> : <RichText body={page.body} />}
        {slug === "politicas-de-entrega" && <ShippingTable shipping={settings.shipping} />}
        {(slug === "fale-conosco" || slug === "nossas-lojas") && <StoreInfo footer={settings.footer} social={settings.social} withMap={slug === "nossas-lojas"} />}
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
