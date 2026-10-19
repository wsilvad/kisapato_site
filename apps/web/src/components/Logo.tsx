/**
 * Marca da loja (logotipo "Ki Sapato", em PNG com fundo transparente). `onLight` usa a versão preta, para fundos claros; sem ele
 * usa a branca, para fundos escuros ou fotos. A altura vem de `--logo-h` (definido por contexto) vezes 0,9.
 */
export function Logo({ className, onLight }: { className?: string; /** Para fundo claro: logo preta. */ onLight?: boolean }) {
  return (
    <span className={`logo${className ? ` ${className}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estática da loja */}
      <img src={onLight ? "/logo.png" : "/logo-branca.png"} alt="Ki Sapato" width={1000} height={237} decoding="async" />
    </span>
  );
}
