import { z } from "zod";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** CPF com os dois dígitos verificadores corretos (e sem ser uma sequência repetida como 111.111.111-11). */
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

/**
 * Telefone brasileiro (DDD + número) → só dígitos com o código do país (55…), como os provedores de SMS esperam.
 * Aceita "(51) 99999-8888", "51999998888" e "+55 51 99999-8888". Devolve null se não parecer um telefone válido.
 */
export function normalizePhone(input: string): string | null {
  let digits = onlyDigits(input);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.length === 11 && digits[2] !== "9") return null; // celular tem o 9 na frente
  if (digits.startsWith("0")) return null; // DDD não começa com 0
  return `55${digits}`;
}

/** 5551999998888 → (51) *****-8888, para dizer ao cliente onde o SMS foi enviado sem mostrar o número inteiro. */
export function maskPhone(normalized: string): string {
  const national = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  if (national.length < 10) return "";
  return `(${national.slice(0, 2)}) ${"*".repeat(national.length - 6)}-${national.slice(-4)}`;
}

/** Regras da senha: 8+ caracteres com letra maiúscula, letra minúscula, número e caractere especial (o bcrypt só considera os primeiros 72). */
export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("ao menos 8 caracteres");
  if (!/\p{Lu}/u.test(password)) issues.push("uma letra maiúscula");
  if (!/\p{Ll}/u.test(password)) issues.push("uma letra minúscula");
  if (!/\d/.test(password)) issues.push("um número");
  if (!/[^\p{L}\d\s]/u.test(password)) issues.push("um caractere especial (ex.: ! @ # $ %)");
  if (password.length > 72) issues.push("no máximo 72 caracteres");
  return issues;
}

export const strongPassword = z.string().superRefine((value, ctx) => {
  const issues = passwordIssues(value);
  if (issues.length > 0) ctx.addIssue({ code: "custom", message: `A senha precisa ter ${issues.join(", ")}` });
});

export const cpfField = z
  .string()
  .trim()
  .refine(isValidCpf, "CPF inválido")
  .transform(onlyDigits);

/** Nome completo: ao menos nome e sobrenome. */
export const fullName = z
  .string()
  .trim()
  .min(5, "Informe o nome completo")
  .max(120)
  .refine((v) => v.split(/\s+/).filter((p) => p.length > 1).length >= 2, "Informe nome e sobrenome");

export const phoneField = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, "Telefone inválido. Use DDD + número, ex.: (51) 99999-8888");

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
