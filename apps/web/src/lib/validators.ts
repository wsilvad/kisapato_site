/** Validações e máscaras da conta do cliente. A API repete todas as regras: aqui servem só para avisar antes de enviar. */

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** 52998224725 → 529.982.247-25 (aceita digitação parcial). */
export function formatCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** 52998224725 → ***.982.247-** (para mostrar sem expor o número inteiro). */
export function maskCpf(cpf: string | null) {
  if (!cpf || cpf.length !== 11) return "";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** 51999998888 → (51) 99999-8888 (aceita digitação parcial). */
export function formatPhone(value: string) {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const area = d.slice(0, 2);
  const rest = d.slice(2);
  const cut = d.length > 10 ? 5 : 4;
  return rest.length > cut ? `(${area}) ${rest.slice(0, cut)}-${rest.slice(cut)}` : `(${area}) ${rest}`;
}

export function isValidPhone(value: string) {
  let d = onlyDigits(value);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return false;
  if (d.startsWith("0")) return false;
  return d.length === 10 || d[2] === "9";
}

/** 93600000 → 93600-000 (aceita digitação parcial). */
export function formatZip(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Nome e sobrenome. */
export function isFullName(value: string) {
  return value.trim().split(/\s+/).filter((p) => p.length > 1).length >= 2;
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** As regras da senha, uma a uma, para mostrar o que ainda falta enquanto o cliente digita. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: "Ao menos 8 caracteres", ok: password.length >= 8 },
    { label: "Uma letra maiúscula", ok: /\p{Lu}/u.test(password) },
    { label: "Uma letra minúscula", ok: /\p{Ll}/u.test(password) },
    { label: "Um número", ok: /\d/.test(password) },
    { label: "Um caractere especial (ex.: ! @ # $ %)", ok: /[^\p{L}\d\s]/u.test(password) },
  ];
}

export const isStrongPassword = (password: string) => password.length <= 72 && passwordChecks(password).every((c) => c.ok);

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

/** Preenche o endereço a partir do CEP (ViaCEP). Só o CEP é enviado; falha de rede ou CEP inexistente devolve null. */
export async function lookupZip(zip: string): Promise<{ street: string; district: string; city: string; state: string } | null> {
  const digits = onlyDigits(zip);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (data.erro) return null;
    return { street: data.logradouro ?? "", district: data.bairro ?? "", city: data.localidade ?? "", state: data.uf ?? "" };
  } catch {
    return null;
  }
}
