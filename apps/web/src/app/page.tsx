import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import { sampleHighlights, sampleLaunches } from "@/lib/sample-products";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Feminino", "Masculino", "Infantil"];

async function loadShowcase(): Promise<{ launches: Product[]; highlights: Product[] }> {
  try {
    const { items } = await api.listProducts({ page: 1 });
    if (items.length > 0) return { launches: items.slice(0, 4), highlights: items.slice(4, 8) };
  } catch {
    // API indisponível: usa os produtos de exemplo do protótipo
  }
  return { launches: sampleLaunches, highlights: sampleHighlights };
}

function ProductSection({ title, products }: { title: string; products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        <Link href="/produtos" className="link-all">
          Ver todos
        </Link>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { launches, highlights } = await loadShowcase();

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">Nova coleção · Primavera</span>
          <h1 className="hero-title">
            Passos que
            <br />
            combinam com
            <br />
            <i>você</i>
          </h1>
          <p className="hero-text">
            Calçados para toda a família, das marcas que você confia, com retirada grátis na loja.
          </p>
          <div className="hero-actions">
            <Link href="/produtos" className="btn btn-solid">
              Ver lançamentos
            </Link>
            <Link href="/produtos" className="btn btn-outline">
              Todos os modelos
            </Link>
          </div>
        </div>
        <div className="hero-media">[Foto de campanha — 820 × 580]</div>
        <div className="hero-dots" aria-hidden="true">
          <span className="is-active" />
          <span />
          <span />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title section-title-center">Compre por categoria</h2>
        <div className="category-grid">
          {CATEGORIES.map((name) => (
            <Link key={name} href="/produtos" className="category-tile">
              <span className="category-photo">[Foto {name}]</span>
              <div className="category-bar">
                <span className="category-name">{name}</span>
                <svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M0 7h26M20 1l6 6-6 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductSection title="Lançamentos" products={launches} />

      <section className="promo-banner">
        <div className="promo-copy">
          <span className="promo-eyebrow">Promoções da semana</span>
          <span className="promo-title">Até [XX]% off</span>
        </div>
        <Link href="/produtos" className="btn btn-light">
          Aproveitar
        </Link>
      </section>

      <ProductSection title="Destaques" products={highlights} />

      <section className="benefits">
        <div>
          <strong>Frete grátis</strong>
          <span>Acima de R$ [VALOR]</span>
        </div>
        <div>
          <strong>Retire na loja</strong>
          <span>Sem custo, em [X] horas</span>
        </div>
        <div>
          <strong>Até 6x sem juros</strong>
          <span>Cartão, Pix ou boleto</span>
        </div>
        <div>
          <strong>Troca fácil</strong>
          <span>Primeira troca grátis</span>
        </div>
      </section>
    </>
  );
}
