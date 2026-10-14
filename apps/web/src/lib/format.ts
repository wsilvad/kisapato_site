export function formatPrice(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

/** Número máximo de parcelas sem juros: até R$ 150 à vista, até R$ 300 em 3x, acima disso em 6x. */
export function maxInstallments(value: string | number) {
  const price = Number(value);
  return price < 150 ? 1 : price < 300 ? 3 : 6;
}

/** Regra de parcelamento do protótipo: até R$ 150 à vista, até R$ 300 em 3x, acima disso em 6x. */
export function installmentText(value: string | number) {
  const price = Number(value);
  const installments = maxInstallments(price);
  if (installments === 1) return "à vista no Pix ou cartão";
  return `ou ${installments}x de ${formatPrice(price / installments)} sem juros`;
}

export const formatInt = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const formatPercent = (ratio: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio);

/** AAAA-MM-DD → DD/MM/AAAA (sem passar por Date, para não deslocar o dia por fuso). */
export const formatDay = (key: string) => key.split("-").reverse().join("/");
