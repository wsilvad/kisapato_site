import type { Metadata } from "next";
import localFont from "next/font/local";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { StoreFrame } from "@/components/StoreFrame";
import { api } from "@/lib/api";
import { loadSettings } from "@/lib/site-settings";
import "./globals.css";

// Fontes hospedadas aqui (src/app/fonts): o build da Discloud não resolvia o next/font/google (ver fonts/README.md).
const serif = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-normal.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/jost.woff2",
  weight: "100 900",
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ki Sapato", template: "%s | Ki Sapato" },
  description: "Calçados para toda a família, das marcas que você confia, com retirada grátis na loja.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // categorias do menu já vêm prontas do servidor (sem esperar o navegador buscar); se a API falhar, o menu busca depois
  const [settings, categories] = await Promise.all([loadSettings(), api.listCategories().catch(() => undefined)]);
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Providers freeShippingAbove={settings.shipping.freeAbove}>
          <StoreFrame header={<Header topbar={settings.topbar} nav={settings.nav} social={settings.social} pages={settings.pages ?? []} categories={categories} />} footer={<Footer footer={settings.footer} social={settings.social} pages={settings.pages ?? []} />} floating={<WhatsAppButton number={settings.footer.whatsapp} />}>
            {children}
          </StoreFrame>
        </Providers>
      </body>
    </html>
  );
}
