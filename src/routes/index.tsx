import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Truck, RefreshCw, CreditCard } from "lucide-react";
import heroImage from "@/assets/ki-sapato-hero.jpg";
import categoriesImage from "@/assets/ki-sapato-categories.jpg";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-catalog";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Ki Sapato — Calçados, bolsas e acessórios" },
    { name: "description", content: "Descubra calçados, bolsas e acessórios femininos, masculinos e infantis em Santo Antônio da Patrulha." },
    { property: "og:title", content: "Ki Sapato — Estilo para todos os passos" },
    { property: "og:description", content: "Novidades em calçados, bolsas e acessórios para toda a família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const { data: products } = useProducts();
  return (
    <div>
      <section className="relative min-h-[calc(100svh-8.5rem)] overflow-hidden md:min-h-[760px]">
        <img src={heroImage} alt="Editorial Ki Sapato com calçados e bolsas" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-foreground/30" />
        <div className="relative mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-[1440px] items-end px-6 pb-16 text-primary-foreground md:min-h-[760px] md:items-center md:pb-0 lg:px-10">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.22em]">Nova coleção</p><h1 className="mt-4 font-display text-5xl font-medium leading-[0.92] sm:text-7xl lg:text-8xl">Estilo para todos os passos.</h1><p className="mt-6 max-w-md text-sm leading-6 text-primary-foreground/85 md:text-base">Calçados, bolsas e acessórios escolhidos para acompanhar sua rotina com personalidade.</p><Button className="mt-8 h-12 rounded-none bg-background px-7 text-foreground hover:bg-background/90" asChild><Link to="/produtos" search={{ busca: undefined, categoria: undefined, genero: undefined }}>Ver coleção <ArrowRight /></Link></Button></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-20 lg:px-8"><div className="mb-10 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Curadoria Ki Sapato</p><h2 className="mt-2 font-display text-4xl sm:text-5xl">Novidades</h2></div><Link to="/produtos" search={{ busca: undefined, categoria: undefined, genero: undefined }} className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] sm:flex">Ver tudo <ArrowRight className="size-4" /></Link></div><div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-7">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div></section>

      <section className="grid md:grid-cols-2"><div className="min-h-[520px] overflow-hidden"><img src={categoriesImage} alt="Seleção de calçados Ki Sapato" width={1536} height={1024} loading="lazy" className="h-full w-full object-cover" /></div><div className="flex items-center bg-foreground px-8 py-16 text-background md:px-14"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">Para cada estilo</p><h2 className="mt-3 max-w-md font-display text-5xl leading-none sm:text-6xl">Encontre o seu próximo favorito.</h2><div className="mt-10 grid grid-cols-2 gap-px bg-background/20">{[["Feminino","feminino"],["Masculino","masculino"],["Infantil","infantil"],["Acessórios","bolsas-e-acessorios"]].map(([label,value]) => <Link key={value} to="/produtos" search={{ categoria: value, busca: undefined, genero: undefined }} className="flex items-center justify-between bg-foreground px-4 py-5 text-sm hover:bg-background/10">{label}<ArrowRight className="size-4" /></Link>)}</div></div></div></section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-6 py-16 text-center sm:grid-cols-2 lg:grid-cols-4 lg:px-8">{[[Truck,"Frete grátis","Acima de R$ 399"],[RefreshCw,"Troca facilitada","Compra sem preocupação"],[CreditCard,"Pagamento flexível","Pix ou cartão"],[MapPin,"Retire na loja","Pátio Urbano, sala 06"]].map(([Icon,title,text]) => { const FeatureIcon = Icon as typeof Truck; return <div key={String(title)}><FeatureIcon className="mx-auto size-5"/><p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em]">{String(title)}</p><p className="mt-2 text-sm text-muted-foreground">{String(text)}</p></div>; })}</section>
    </div>
  );
}
