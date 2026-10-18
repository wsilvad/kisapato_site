import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PAYMENT_ICONS, PaymentIcon } from "@/components/PaymentIcons";
import { SocialLinks } from "@/components/SocialLinks";
import { isEmptyPage } from "@/lib/account-menu";
import type { SiteSettings } from "@/types/product";

/**
 * Rodapé no estilo da Luz da Lua: logo no centro, os grupos de links (Institucional…) como menus que abrem
 * só ao clicar e, embaixo, dados da loja, redes sociais e formas de pagamento.
 */
export function Footer({ footer, social, pages }: { footer: SiteSettings["footer"]; social: SiteSettings["social"]; pages: SiteSettings["pages"] }) {
  const { columns, address, phone, hours, cnpj } = footer;
  const hasSocial = Object.values(social).some(Boolean);
  const paymentList = (footer.paymentMethods ?? []).filter((m) => PAYMENT_ICONS[m]);
  const groups = columns.map((c) => ({ ...c, links: c.links.filter((l) => !isEmptyPage(l.url, pages)) })).filter((c) => c.links.length > 0);

  return (
    <footer className="footer">
      <Link href="/" className="footer-brand" aria-label="Ki Sapato — página inicial">
        <Logo onLight className="footer-logo" />
      </Link>

      <div className="footer-menus">
        {groups.map((group) => (
          <details key={group.title} className="footer-acc">
            <summary>
              {group.title}
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M1 1.500l5 5 5-5" /></svg>
            </summary>
            <ul>
              {group.links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <Link href={link.url}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="footer-bottom">
        <p className="footer-legal">
          © {new Date().getFullYear()} Todos os direitos reservados. Ki Sapato
          {address && <> / {address}</>}
          {cnpj && <> / CNPJ {cnpj}</>}
          {(phone || hours) && (
            <>
              <br />
              {[phone, hours].filter(Boolean).join(" · ")}
            </>
          )}
        </p>
        {hasSocial && (
          <div className="footer-block">
            <h2>Redes sociais</h2>
            <SocialLinks social={social} className="footer-social" />
          </div>
        )}
        {paymentList.length > 0 && (
          <div className="footer-block">
            <h2>Formas de pagamento</h2>
            <ul className="footer-payments">
              {paymentList.map((m) => (
                <li key={m}>
                  <PaymentIcon method={m} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </footer>
  );
}
