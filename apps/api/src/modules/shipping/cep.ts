/** Faixas de CEP por estado (publicadas pelos Correios), para saber a região sem depender de nenhum serviço externo. */
const RANGES: [number, number, string][] = [
  [1_000_000, 19_999_999, "SP"],
  [20_000_000, 28_999_999, "RJ"],
  [29_000_000, 29_999_999, "ES"],
  [30_000_000, 39_999_999, "MG"],
  [40_000_000, 48_999_999, "BA"],
  [49_000_000, 49_999_999, "SE"],
  [50_000_000, 56_999_999, "PE"],
  [57_000_000, 57_999_999, "AL"],
  [58_000_000, 58_999_999, "PB"],
  [59_000_000, 59_999_999, "RN"],
  [60_000_000, 63_999_999, "CE"],
  [64_000_000, 64_999_999, "PI"],
  [65_000_000, 65_999_999, "MA"],
  [66_000_000, 68_899_999, "PA"],
  [68_900_000, 68_999_999, "AP"],
  [69_000_000, 69_299_999, "AM"],
  [69_300_000, 69_399_999, "RR"],
  [69_400_000, 69_899_999, "AM"],
  [69_900_000, 69_999_999, "AC"],
  [70_000_000, 72_799_999, "DF"],
  [72_800_000, 72_999_999, "GO"],
  [73_000_000, 73_699_999, "DF"],
  [73_700_000, 76_799_999, "GO"],
  [76_800_000, 76_999_999, "RO"],
  [77_000_000, 77_999_999, "TO"],
  [78_000_000, 78_899_999, "MT"],
  [79_000_000, 79_999_999, "MS"],
  [80_000_000, 87_999_999, "PR"],
  [88_000_000, 89_999_999, "SC"],
  [90_000_000, 99_999_999, "RS"],
];

/** Só os 8 dígitos do CEP (ou null se não for um CEP). */
export function normalizeCep(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** Estado (UF) de um CEP de 8 dígitos; null para faixas que não existem. */
export function stateFromCep(cep: string): string | null {
  const n = Number(cep);
  return RANGES.find(([from, to]) => n >= from && n <= to)?.[2] ?? null;
}
