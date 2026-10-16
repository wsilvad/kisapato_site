import Link from "next/link";
import { HeroCarousel } from "@/components/HeroCarousel";
import { StoriesRow } from "@/components/StoriesRow";
import { ProductCard } from "@/components/ProductCard";
import { api, assetUrl } from "@/lib/api";
import { audienceHref } from "@/lib/segment";
import { loadSettings } from "@/lib/site-settings";
import { sampleLaunches } from "@/lib/sample-products";
import type { Audience, Campaign, Category, Product, Story } from "@/types/product";

export const dynamic = "force-dynamic";

interface Section {
  id: string;
  title: string;
  products: Product[];
}

async function loadHome(): Promise<{ campaigns: Campaign[]; categories: Category[]; audiences: Audience[]; stories: Story[]; sections: Section[] }> {
  try {
    const home = await api.home();
    const sections = home.showcases
      .filter((s) => s.products.length > 0)
      .map((s) => ({ id: s.id, title: s.title, products: s.products }));
    if (sections.length === 0) {
      // Nenhuma vitrine configurada: mostra os produtos mais recentes para a home nunca ficar vazia.
      const { items } = await api.listProducts({ page: 1 });
      if (items.length > 0) sections.push({ id: "latest", title: "Lançamentos", products: items.slice(0, 4) });
    }
    return { campaigns: home.campaigns, categories: home.categories, audiences: home.audiences ?? [], stories: home.stories ?? [], sections };
  } catch {
    // API indisponível: usa os produtos de exemplo do protótipo
    return { campaigns: [], categories: [], audiences: [], stories: [], sections: [{ id: "sample", title: "Lançamentos", products: sampleLaunches }] };
  }
}

function ProductSection({ title, products }: { title: string; products: Product[] }) {
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
  const [{ campaigns, categories, audiences, stories, sections }, settings] = await Promise.all([loadHome(), loadSettings()]);
  const { promo, benefits } = settings;
  const [first, ...rest] = sections;

  return (
    <>
      <HeroCarousel campaigns={campaigns} />

      <StoriesRow stories={stories} />

      {categories.length > 0 && (
        <section className="section">
          <h2 className="section-title section-title-center">Compre por categoria</h2>
          <div className="category-grid">
            {categories.map((category) => {
              const image = assetUrl(category.imageUrl);
              return (
                <Link key={category.id} href={`/produtos?categoria=${category.slug}`} className="category-tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {image && <img className="category-img" src={image} alt="" />}
                  <div className="category-bar">
                    <span className="category-name">{category.name}</span>
                    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M0 7h26M20 1l6 6-6 6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {first && <ProductSection title={first.title} products={first.products} />}

      {audiences.length > 0 && (
        <section className="section">
          <h2 className="section-title section-title-center">Compre por público</h2>
          <div className="category-grid">
            {audiences.map((audience) => (
              <Link key={audience.id} href={audienceHref(audience)} className="category-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="category-img" src={assetUrl(audience.imageUrl) ?? ""} alt="" />
                <div className="category-bar">
                  <span className="category-name">{audience.name}</span>
                  <svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M0 7h26M20 1l6 6-6 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {promo.active && promo.title && (
        <section className="promo-banner">
          <div className="promo-copy">
            {promo.eyebrow && <span className="promo-eyebrow">{promo.eyebrow}</span>}
            <span className="promo-title">{promo.title}</span>
          </div>
          {promo.buttonLabel && (
            <Link href={promo.buttonUrl || "/produtos"} className="btn btn-light">
              {promo.buttonLabel}
            </Link>
          )}
        </section>
      )}

      {rest.map((section) => (
        <ProductSection key={section.id} title={section.title} products={section.products} />
      ))}

      {benefits.length > 0 && (
        <section className="benefits">
          {benefits.map((benefit) => (
            <div key={benefit.title}>
              <strong>{benefit.title}</strong>
              {benefit.text && <span>{benefit.text}</span>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
