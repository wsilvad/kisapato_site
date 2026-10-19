import Link from "next/link";

interface Props {
  description: string | null;
  care: string | null;
}

/** Item suspenso: o título é a linha clicável e o conteúdo abre e fecha abaixo dela. */
function Item({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="pdp-acc-item" open={open}>
      <summary>{title}</summary>
      <div className="pdp-acc-body">{children}</div>
    </details>
  );
}

/**
 * Descrição e garantia do produto em itens suspensos (acordeão), abaixo do cálculo de frete, como na loja de referência.
 * O conteúdo vem do cadastro do produto no painel. Os detalhes (marca, categoria…) ficam à mostra abaixo da foto.
 */
export function ProductDetails({ description, care }: Props) {
  return (
    <div className="pdp-acc">
      <Item title="Descrição">
        {description ? <p className="pdp-acc-text">{description}</p> : <p className="pdp-acc-empty">Este produto ainda não tem descrição.</p>}
      </Item>
      <Item title="Garantia e Cuidados">
        {care && <p className="pdp-acc-text">{care}</p>}
        <p className="pdp-acc-text">
          Defeito de fabricação, troca ou arrependimento: veja as regras em <Link href="/institucional/trocas-e-devolucoes">Trocas e devoluções</Link>.
        </p>
      </Item>
    </div>
  );
}

/** Detalhes do produto (marca, categoria, público, referência) direto abaixo da foto, sem item suspenso. */
export function ProductSpecs({ specs }: { specs: { label: string; value: string }[] }) {
  if (specs.length === 0) return null;
  return (
    <section className="pdp-specs" aria-labelledby="pdp-specs-title">
      <h2 id="pdp-specs-title">Detalhes do produto</h2>
      <dl>
        {specs.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
