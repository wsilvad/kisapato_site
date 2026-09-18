import Link from "next/link";

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          Ki Sapato
        </Link>
        <nav className="nav">
          <Link href="/produtos">Produtos</Link>
        </nav>
      </div>
    </header>
  );
}
