"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/api";
import { cropVars } from "@/lib/crop";
import type { Campaign } from "@/types/product";

const ROTATE_MS = 6000;

/** Hero da home: mostra as campanhas vigentes em rodízio; sem campanhas, o texto padrão da loja. */
export function HeroCarousel({ campaigns }: { campaigns: Campaign[] }) {
  const [index, setIndex] = useState(0);
  const count = campaigns.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count, index]);

  const campaign = campaigns[index % Math.max(count, 1)];
  const desktop = assetUrl(campaign?.desktopImageUrl);
  const mobile = assetUrl(campaign?.mobileImageUrl);

  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">{campaign?.eyebrow ?? "Nova coleção"}</span>
        <h1 className="hero-title">{campaign?.title ?? "Passos que combinam com você"}</h1>
        <p className="hero-text">
          {campaign ? campaign.body : "Calçados para toda a família, das marcas que você confia, com retirada grátis na loja."}
        </p>
        <div className="hero-actions">
          <Link href={campaign?.buttonUrl || "/produtos"} className="btn btn-solid">
            {campaign?.buttonLabel || "Ver lançamentos"}
          </Link>
          <Link href="/produtos" className="btn btn-outline">
            Todos os modelos
          </Link>
        </div>
      </div>
      <div className="hero-media">
        {desktop ? (
          <picture>
            {mobile && <source media="(max-width: 720px)" srcSet={mobile} />}
            <img src={desktop} alt={campaign?.title ?? ""} style={cropVars(campaign)} />
          </picture>
        ) : null}
      </div>
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
