export function formatPrice(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

/** Regra de parcelamento do protótipo: até R$ 150 à vista, até R$ 300 em 3x, acima disso em 6x. */
export function installmentText(value: string | number) {
  const price = Number(value);
  if (price < 150) return "à vista no Pix ou cartão";
  const installments = price < 300 ? 3 : 6;
  return `ou ${installments}x de ${formatPrice(price / installments)} sem juros`;
}
