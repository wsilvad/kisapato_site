"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/api";
import { cropVars } from "@/lib/crop";
import type { Campaign } from "@/types/product";

const ROTATE_MS = 6000;

/**
 * Hero da home: foto da campanha na tela inteira (o cabeçalho fica por cima), com o texto embaixo à esquerda e o
 * botão da campanha centralizado na parte de baixo. Várias campanhas vigentes entram em rodízio, com setas e
 * marcadores; sem campanhas, o texto padrão da loja.
 */
export function HeroCarousel({ campaigns }: { campaigns: Campaign[] }) {
  const [index, setIndex] = useState(0);
  const count = campaigns.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count, index]);

  const campaign = campaigns[index % Math.max(count, 1)];
  const go = (step: 1 | -1) => setIndex((i) => (i + step + count) % count);
  const desktop = assetUrl(campaign?.desktopImageUrl);
  const mobile = assetUrl(campaign?.mobileImageUrl);
  // Um botão por banner, com nome e destino escolhidos no painel; sem destino, o banner fica sem botão.
  const button = campaign
    ? campaign.buttonUrl
      ? { url: campaign.buttonUrl, label: (campaign.buttonLabel || "Confira").toLocaleUpperCase("pt-BR") }
      : null
    : { url: "/produtos?selo=lancamento", label: "VER LANÇAMENTOS" };

  return (
    <section className={`hero${desktop ? "" : " hero-plain"}`}>
      <div className="hero-media">
        {desktop ? (
          <picture key={campaign?.id}>
            {mobile && <source media="(max-width: 720px)" srcSet={mobile} />}
            <img src={desktop} alt={campaign?.title ?? ""} style={cropVars(campaign)} />
          </picture>
        ) : null}
      </div>
      <div className="hero-copy">
        <span className="hero-eyebrow">{campaign?.eyebrow ?? "Nova coleção"}</span>
        <h1 className="hero-title">{campaign?.title ?? "Passos que combinam com você"}</h1>
        <p className="hero-text">
          {campaign ? campaign.body : "Calçados para toda a família, das marcas que você confia, com retirada grátis na loja."}
        </p>
      </div>
      {button && (
        <div className="hero-actions">
          <Link key={campaign?.id} href={button.url} className="btn btn-solid hero-button" data-track-id={campaign?.id}>
            {button.label}
          </Link>
        </div>
      )}
      {count > 1 && (
        <>
          <button type="button" className="hero-arrow hero-prev" aria-label="Campanha anterior" onClick={() => go(-1)}>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10 1L2 10l8 9" /></svg>
          </button>
          <button type="button" className="hero-arrow hero-next" aria-label="Próxima campanha" onClick={() => go(1)}>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 1l8 9-8 9" /></svg>
          </button>
        </>
      )}
      {count > 1 && (
        <div className="hero-dots">
          {campaigns.map((c, i) => (
            <button key={c.id} type="button" className={i === index ? "is-active" : ""} aria-label={`Campanha ${i + 1}: ${c.title}`} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </section>
  );
}
