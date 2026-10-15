import type { AgeGroup, Gender, Prisma } from "../../generated/prisma/client.js";

/** Faixa etária e gênero como aparecem na URL da loja (`?faixa=infantil&genero=feminino`). */
export const AGE_GROUP_SLUG = { adulto: "ADULTO", infantil: "INFANTIL" } as const satisfies Record<string, AgeGroup>;
export const GENDER_SLUG = { feminino: "FEMININO", masculino: "MASCULINO", unissex: "UNISSEX" } as const satisfies Record<string, Gender>;

export const ageGroupsOf = (slugs: string[]) => slugs.flatMap((s) => (s in AGE_GROUP_SLUG ? [AGE_GROUP_SLUG[s as keyof typeof AGE_GROUP_SLUG]] : []));
export const gendersOf = (slugs: string[]) => slugs.flatMap((s) => (s in GENDER_SLUG ? [GENDER_SLUG[s as keyof typeof GENDER_SLUG]] : []));

/** Feminino e masculino trazem também os unissex; "unissex" sozinho traz só os unissex. */
export function genderWhere(genders: Gender[]): Prisma.ProductWhereInput {
  const set = new Set<Gender>(genders);
  if (set.has("FEMININO") || set.has("MASCULINO")) set.add("UNISSEX");
  return { gender: { in: [...set] } };
}

/** Rótulo único do produto para relatórios e ficha: "Feminino", "Infantil · Menina"… */
export function segmentLabel(ageGroup: AgeGroup, gender: Gender) {
  if (ageGroup === "INFANTIL") return `Infantil · ${{ FEMININO: "Menina", MASCULINO: "Menino", UNISSEX: "Unissex" }[gender]}`;
  return { FEMININO: "Feminino", MASCULINO: "Masculino", UNISSEX: "Unissex" }[gender];
}
