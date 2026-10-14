"use client";

import { useFavorites } from "@/lib/favorites";

const Heart = ({ filled }: { filled: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20.5S3 15.2 3 8.9C3 6 5.2 4 7.7 4c1.8 0 3.3.9 4.3 2.5C13 4.9 14.5 4 16.3 4 18.8 4 21 6 21 8.9 21 15.2 12 20.5 12 20.5Z" />
  </svg>
);

/** Coração de favoritar. `variant="icon"` é o botão redondo sobre a foto do cartão; `"block"` é o botão da página do produto. */
export function FavoriteButton({ slug, name, variant = "icon" }: { slug: string; name: string; variant?: "icon" | "block" }) {
  const { has, toggle } = useFavorites();
  const on = has(slug);
  const label = on ? `Remover ${name} dos favoritos` : `Adicionar ${name} aos favoritos`;
  return (
    <button type="button" className={`fav-btn fav-${variant}${on ? " is-on" : ""}`} aria-pressed={on} aria-label={label} title={on ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggle(slug)}>
      <Heart filled={on} />
      {variant === "block" && <span>{on ? "Nos favoritos" : "Favoritar"}</span>}
    </button>
  );
}
