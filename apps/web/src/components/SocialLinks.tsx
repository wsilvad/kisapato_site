import type { SiteSettings } from "@/types/product";

type Social = SiteSettings["social"];

/** Ícones em linhas simples (24×24), no mesmo traço do resto do site. */
const ICONS: Record<keyof Social, { label: string; svg: React.ReactNode }> = {
  facebook: { label: "Facebook", svg: <path d="M14 8.500V7c0-.7.2-1 1.100-1H17V3h-2.600C11.700 3 10.500 4.600 10.500 6.800V8.500H8V12h2.500v9H14v-9h2.600l.4-3.500H14Z" fill="currentColor" stroke="none" /> },
  instagram: {
    label: "Instagram",
    svg: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4.500" />
        <circle cx="12" cy="12" r="3.600" />
        <circle cx="16.800" cy="7.200" r="0.900" fill="currentColor" stroke="none" />
      </>
    ),
  },
  pinterest: { label: "Pinterest", svg: <path d="M12 3.500c-4.700 0-7 3.200-7 6.200 0 1.800.7 3.400 2.200 4 .2.100.5 0 .5-.3l.2-.9c.1-.3 0-.4-.2-.7-.4-.5-.7-1.100-.7-2 0-2.600 1.900-4.900 5.100-4.900 2.800 0 4.300 1.700 4.300 4 0 3-1.300 5.500-3.300 5.500-1.100 0-1.900-.9-1.600-2 .3-1.300.9-2.700.9-3.600 0-.8-.4-1.500-1.400-1.500-1.100 0-2 1.200-2 2.800 0 1 .3 1.700.3 1.700l-1.300 5.400c-.3 1.500 0 3.300 0 3.500 0 .1.200.2.300.1.100-.1 1.400-1.800 1.800-3.400l.7-2.700c.4.700 1.400 1.300 2.600 1.300 3.400 0 5.700-3.100 5.700-7 0-3-2.500-5.500-6.100-5.500Z" fill="currentColor" stroke="none" /> },
  tiktok: { label: "TikTok", svg: <path d="M15.500 3h-3v11.700a2.600 2.600 0 1 1-2.600-2.600c.3 0 .5 0 .7.100V9.100c-.2 0-.5-.1-.7-.1a5.700 5.700 0 1 0 5.700 5.700V8.900a6.200 6.200 0 0 0 3.600 1.200V7.300a3.600 3.600 0 0 1-3.600-3.400V3Z" fill="currentColor" stroke="none" /> },
};

/** Ícones das redes sociais da loja; só aparecem as que têm endereço cadastrado em "Textos e menu". */
export function SocialLinks({ social, className }: { social: Social; className?: string }) {
  const active = (Object.keys(ICONS) as (keyof Social)[]).filter((key) => social[key]);
  if (active.length === 0) return null;
  return (
    <ul className={`sh-social${className ? ` ${className}` : ""}`} aria-label="Redes sociais">
      {active.map((key) => (
        <li key={key}>
          <a href={social[key]} target="_blank" rel="noopener noreferrer" aria-label={ICONS[key].label}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{ICONS[key].svg}</svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
