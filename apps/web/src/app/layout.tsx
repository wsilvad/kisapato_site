import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { StoreFrame } from "@/components/StoreFrame";
import { loadSettings } from "@/lib/site-settings";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ki Sapato", template: "%s | Ki Sapato" },
  description: "Calçados para toda a família, das marcas que você confia, com retirada grátis na loja.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await loadSettings();
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Providers freeShippingAbove={settings.shipping.freeAbove}>
          <StoreFrame header={<Header topbar={settings.topbar} nav={settings.nav} social={settings.social} />} footer={<Footer footer={settings.footer} social={settings.social} pages={settings.pages ?? []} />}>
            {children}
          </StoreFrame>
        </Providers>
      </body>
    </html>
  );
}
