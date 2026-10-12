import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { SiteSettings } from "@/types/product";

export function Footer({ footer }: { footer: SiteSettings["footer"] }) {
  const { columns, storeTitle, address, phone, hours, cnpj, payments } = footer;
  const storeLines = [address, phone, hours].filter(Boolean);

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-col">
          <Logo className="footer-logo" />
        </div>

        {columns.map((column) => (
          <div key={column.title} className="footer-col">
            <h2 className="footer-title">{column.title}</h2>
            {column.links.map((link) => (
              <Link key={`${link.label}-${link.url}`} href={link.url}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}

        {storeLines.length > 0 && (
          <div className="footer-col">
            <h2 className="footer-title">{storeTitle}</h2>
            {storeLines.map((line) => (
              <span key={line} className="footer-muted">
                {line}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="footer-bottom">
        <span>© Ki Sapato{cnpj ? ` · CNPJ ${cnpj}` : ""}</span>
        {payments && <span>{payments}</span>}
      </div>
    </footer>
  );
}
