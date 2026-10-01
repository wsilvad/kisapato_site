import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartProvider, useCart } from "@/lib/cart";
import logoAsset from "@/assets/logo.png.asset.json";

const nav = [
  ["Feminino", "feminino"], ["Masculino", "masculino"], ["Infantil", "infantil"],
  ["Calçados", "sapatos"], ["Bolsas & acessórios", "bolsas-e-acessorios"], ["Sale", "promocao"],
] as const;

function Header() {
  const cart = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const runSearch = () => navigate({ to: "/produtos", search: { busca: query || undefined, categoria: undefined, genero: undefined } });
  return (
    <>
      <div className="bg-foreground px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-background sm:text-xs">Frete grátis para compras acima de R$ 399</div>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-4 lg:px-8">
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-none lg:hidden" aria-label="Abrir menu"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="rounded-none"><SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader><nav className="mt-8 grid gap-5">{nav.map(([label, value]) => <Link key={value} to="/produtos" search={{ categoria: value, busca: undefined, genero: undefined }} className="border-b pb-3 font-display text-2xl">{label}</Link>)}</nav></SheetContent>
          </Sheet>
          <Link to="/" aria-label="Ki Sapato — início"><img src={logoAsset.url} alt="Ki Sapato" className="h-14 w-auto object-contain" /></Link>
          <nav className="hidden items-center gap-7 lg:flex">{nav.map(([label, value]) => <Link key={value} to="/produtos" search={{ categoria: value, busca: undefined, genero: undefined }} className="text-xs font-medium uppercase tracking-[0.12em] hover:underline">{label}</Link>)}</nav>
          <div className="flex items-center gap-1">
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-none" aria-label="Buscar"><Search /></Button></SheetTrigger>
              <SheetContent side="top" className="rounded-none"><SheetHeader><SheetTitle className="font-display text-3xl">O que você procura?</SheetTitle></SheetHeader><div className="mx-auto mt-8 flex w-full max-w-3xl border-b border-foreground"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Digite o nome do produto" className="h-14 flex-1 bg-transparent outline-none" /><Button size="icon" variant="ghost" className="rounded-none" onClick={runSearch}><Search /></Button></div></SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" className="hidden rounded-none sm:inline-flex" asChild><Link to="/auth" aria-label="Minha conta"><UserRound /></Link></Button>
            <Button variant="ghost" size="icon" className="relative rounded-none" asChild><Link to="/sacola" aria-label={`Sacola com ${cart.count} itens`}><ShoppingBag />{cart.count > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] text-background">{cart.count}</span>}</Link></Button>
          </div>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return <footer className="mt-24 bg-foreground text-background"><div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 md:grid-cols-4 lg:px-8"><div><p className="font-display text-4xl">KI SAPATO</p><p className="mt-3 text-sm text-background/70">Estilo para todos os passos.</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Atendimento</p><p className="mt-4 text-sm leading-7 text-background/70">Segunda a sexta: 8h30–18h30<br/>Sábado: 8h30–17h<br/>(51) 99811-3318</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Nossa loja</p><p className="mt-4 text-sm leading-7 text-background/70">Av. Cel. Victor Villa Verde, 300<br/>Sala 06 — Pátio Urbano<br/>Santo Antônio da Patrulha/RS</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Institucional</p><div className="mt-4 grid gap-2 text-sm text-background/70"><Link to="/produtos" search={{ busca: undefined, categoria: undefined, genero: undefined }}>Todos os produtos</Link><Link to="/auth">Minha conta</Link><a href="https://wa.me/5551998113318" target="_blank" rel="noreferrer">Fale pelo WhatsApp</a></div></div></div><div className="border-t border-background/20 px-6 py-5 text-center text-[10px] uppercase tracking-[0.14em] text-background/60">© 2026 Ki Sapato. Todos os direitos reservados.</div></footer>;
}

export function ShopShell({ children }: { children: ReactNode }) {
  return <CartProvider><div className="min-h-screen bg-background"><Header /><main>{children}</main><Footer /></div></CartProvider>;
}