import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-col">
          <Image src="/logo.png" alt="Ki Sapato" width={220} height={275} className="footer-logo" />
        </div>

        <div className="footer-col">
          <h2 className="footer-title">Comprar</h2>
          <Link href="/produtos">Feminino</Link>
          <Link href="/produtos">Masculino</Link>
          <Link href="/produtos">Infantil</Link>
          <Link href="/produtos">Marcas</Link>
        </div>

        <div className="footer-col">
          <h2 className="footer-title">Ajuda</h2>
          <a href="#">Trocas e devoluções</a>
          <a href="#">Prazos de entrega</a>
          <a href="#">Minha conta e pedidos</a>
          <a href="#">Política de privacidade</a>
        </div>

        <div className="footer-col">
          <h2 className="footer-title">Nossas lojas</h2>
          <span className="footer-muted">[Endereço da loja]</span>
          <span className="footer-muted">[Telefone / WhatsApp]</span>
          <span className="footer-muted">[Horário de atendimento]</span>
        </div>

        <form className="footer-col footer-news">
          <label htmlFor="news" className="footer-title">
            Receba novidades
          </label>
          <input id="news" type="email" placeholder="Seu e-mail" />
          <button type="button">Cadastrar</button>
        </form>
      </div>

      <div className="footer-bottom">
        <span>© Ki Sapato · CNPJ [00.000.000/0000-00]</span>
        <span>Visa · Mastercard · Elo · Hipercard · Boleto · Pix</span>
      </div>
    </footer>
  );
}
