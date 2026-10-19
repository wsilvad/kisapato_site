"use client";

import { useMemo, useState } from "react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShippingCalc } from "@/components/pdp/ShippingCalc";
import { thumbUrl } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { formatPrice, installmentText, maxInstallments } from "@/lib/format";
import type { Product, ProductColor } from "@/types/product";

interface Props {
  product: Product;
  /** Cores na ordem da loja (a primeira é a que a página abre), cada uma com a miniatura da sua primeira foto. */
  colors: ProductColor[];
  color: string;
  onColorChange: (color: string) => void;
  /** Foto da cor escolhida, que vai para a sacola. */
  cartImage?: string;
}

/** Coluna de informações da página do produto: nome, código, preço, pagamento, cor, numeração, compra e frete. */
export function ProductInfo({ product, colors, color, onColorChange, cartImage }: Props) {
  const { add } = useCart();
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const [variantId, setVariantId] = useState("");
  const [hint, setHint] = useState(false);

  const sizes = variants.filter((v) => v.color === color);
  const selected = variants.find((v) => v.id === variantId);
  const code = selected?.sku ?? sizes[0]?.sku ?? variants[0]?.sku;
  const price = Number(product.price);
  const installments = maxInstallments(price);
  const discount = product.compareAtPrice ? Math.round((1 - price / Number(product.compareAtPrice)) * 100) : 0;
  const available = variants.some((v) => v.stock > 0);

  function handleAdd() {
    if (!selected) return setHint(true);
    add({ variantId: selected.id, slug: product.slug, name: product.name, image: cartImage ?? product.images[0], size: selected.size, color: selected.color, price: product.price, stock: selected.stock });
  }

  return (
    <div className="pdp-info">
      <div className="pdp-title-row">
        <h1 className="pdp-title">{product.name}</h1>
        <FavoriteButton slug={product.slug} name={product.name} />
      </div>
      {(code || product.reference) && (
        <p className="pdp-codes">
          {code && <>Cód. {code}</>}{code && product.reference && " · "}{product.reference && <>Ref. {product.reference}</>}
        </p>
      )}

      <div className="pdp-price">
        {product.compareAtPrice && (
          <p className="pdp-old">
            <s>{formatPrice(product.compareAtPrice)}</s> {discount > 0 && <span className="pdp-off">−{discount}%</span>}
          </p>
        )}
        <p className="pdp-now">{formatPrice(price)}</p>
        <p className="pdp-install">{installmentText(price)}</p>
        <details className="pdp-pay">
          <summary>Ver formas de pagamento</summary>
          <ul>
            <li><strong>Cartão de crédito</strong><span>{installments > 1 ? `em até ${installments}x de ${formatPrice(price / installments)} sem juros` : `à vista, ${formatPrice(price)}`}</span></li>
            <li><strong>Pix</strong><span>à vista, {formatPrice(price)}</span></li>
            <li><strong>Boleto bancário</strong><span>à vista, {formatPrice(price)}</span></li>
          </ul>
        </details>
      </div>

      {variants.length === 0 || !available ? (
        <p className="pdp-unavailable">Produto indisponível no momento.</p>
      ) : (
        <>
          {colors.length > 1 && (
            <fieldset className="pdp-field">
              <legend>Cor: <strong>{color}</strong></legend>
              <div className="pdp-colors">
                {colors.map((c) => (
                  <button key={c.name} type="button" className={c.name === color ? "is-on" : undefined} aria-pressed={c.name === color} aria-label={`Cor ${c.name}`} onClick={() => (onColorChange(c.name), setVariantId(""), setHint(false))}>
                    <span className="pdp-swatch">
                      {c.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl(c.images[0])} alt="" loading="lazy" draggable={false} />
                      ) : null}
                    </span>
                    <span className="pdp-color-name">{c.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className={`pdp-field${hint ? " is-missing" : ""}`}>
            <legend>Numeração{selected && <>: <strong>{selected.size}</strong></>}</legend>
            <div className="pdp-sizes" role="radiogroup" aria-label="Numeração">
              {sizes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === variantId}
                  disabled={v.stock === 0}
                  className={v.id === variantId ? "is-on" : undefined}
                  title={v.stock === 0 ? "Indisponível" : undefined}
                  onClick={() => (setVariantId(v.id), setHint(false))}
                >
                  {v.size}
                </button>
              ))}
            </div>
            {hint && <p className="form-error" role="alert">Escolha a numeração para adicionar à sacola.</p>}
            {selected && selected.stock > 0 && selected.stock <= 3 && <p className="pdp-low">Últimas {selected.stock} unidades nessa numeração.</p>}
          </fieldset>

          <div className="pdp-actions">
            <button type="button" className="btn btn-solid" onClick={handleAdd}>Adicionar à sacola</button>
            <FavoriteButton slug={product.slug} name={product.name} variant="block" />
          </div>
        </>
      )}

      <ShippingCalc subtotal={price} />
    </div>
  );
}
