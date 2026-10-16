/**
 * Marca da loja: quadrado branco com "KI" e "SAPATO" ao lado. É texto estilizado (não imagem), então
 * fica nítida em qualquer tamanho. O tamanho vem de `--logo-h` (altura do quadrado), definido por contexto.
 */
export function Logo({ className, onLight }: { className?: string; /** Para fundo claro: quadrado preto e texto escuro. */ onLight?: boolean }) {
  return (
    <span className={`logo${onLight ? " logo-on-light" : ""}${className ? ` ${className}` : ""}`} role="img" aria-label="Ki Sapato">
      <span className="logo-ki" aria-hidden="true">KI</span>
      <span className="logo-sapato" aria-hidden="true">SAPATO</span>
    </span>
  );
}
