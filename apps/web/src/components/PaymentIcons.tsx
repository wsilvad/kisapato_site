/**
 * Logos dos meios de pagamento, desenhados em uma cor só (`currentColor`), no padrão discreto de rodapé de loja.
 * A ordem aqui é a ordem em que aparecem no painel.
 */
export const PAYMENT_ICONS: Record<string, { label: string; width: number; svg: React.ReactNode }> = {
  visa: {
    label: "Visa",
    width: 44,
    svg: (
      <text x="0" y="15" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontSize="16" fontStyle="italic" fontWeight="900" letterSpacing="-0.6" fill="currentColor">
        VISA
      </text>
    ),
  },
  mastercard: {
    label: "Mastercard",
    width: 28,
    svg: (
      <>
        <circle cx="10" cy="10" r="8" fill="currentColor" />
        <circle cx="18" cy="10" r="8" fill="currentColor" opacity="0.5" />
      </>
    ),
  },
  elo: {
    label: "Elo",
    width: 20,
    svg: (
      <>
        <circle cx="10" cy="10" r="9.500" fill="currentColor" />
        <text x="10" y="12.800" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fontWeight="700" fill="#fff">
          elo
        </text>
      </>
    ),
  },
  hipercard: {
    label: "Hipercard",
    width: 50,
    svg: (
      <>
        <rect x="0.500" y="2" width="49" height="16" rx="3" fill="currentColor" />
        <text x="25" y="13.600" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontStyle="italic" fontWeight="700" fill="#fff">
          Hipercard
        </text>
      </>
    ),
  },
  amex: {
    label: "American Express",
    width: 38,
    svg: (
      <>
        <rect x="0.700" y="1.700" width="36.600" height="16.600" rx="2" fill="none" stroke="currentColor" strokeWidth="1.400" />
        <text x="19" y="9" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.200" fontWeight="700" fill="currentColor">
          AMERICAN
        </text>
        <text x="19" y="15.400" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.200" fontWeight="700" fill="currentColor">
          EXPRESS
        </text>
      </>
    ),
  },
  diners: {
    label: "Diners Club",
    width: 20,
    svg: (
      <>
        <path d="M10 1a9 9 0 1 0 .001 0Zm0 3.400a5.600 5.600 0 1 1-.001 0Z" fill="currentColor" fillRule="evenodd" />
        <rect x="9.200" y="4.400" width="1.600" height="11.200" fill="currentColor" />
      </>
    ),
  },
  boleto: {
    label: "Boleto",
    width: 58,
    svg: (
      <>
        {[0, 2.500, 4, 7, 8.500, 11, 13.500, 15, 18].map((x, i) => (
          <rect key={x} x={x} y="3" width={i % 3 === 0 ? 1.600 : 0.900} height="14" fill="currentColor" />
        ))}
        <text x="22" y="14.200" fontFamily="Arial, Helvetica, sans-serif" fontSize="10.500" fontWeight="700" fill="currentColor">
          boleto
        </text>
      </>
    ),
  },
  pix: {
    label: "Pix",
    width: 38,
    svg: (
      <>
        <path d="M8 2.500 15.500 10 8 17.500.500 10Z" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinejoin="round" />
        <text x="18" y="14.500" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="700" fill="currentColor">
          pix
        </text>
      </>
    ),
  },
};

export function PaymentIcon({ method }: { method: string }) {
  const icon = PAYMENT_ICONS[method];
  if (!icon) return null;
  return (
    <svg width={icon.width} height="20" viewBox={`0 0 ${icon.width} 20`} role="img" aria-label={icon.label}>
      <title>{icon.label}</title>
      {icon.svg}
    </svg>
  );
}
