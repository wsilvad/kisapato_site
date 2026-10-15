/** Faixa etária e gênero do produto (na URL: `?faixa=infantil&genero=feminino`). */
export type AgeGroup = "ADULTO" | "INFANTIL";
export type Gender = "FEMININO" | "MASCULINO" | "UNISSEX";

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = { ADULTO: "Adulto", INFANTIL: "Infantil" };
export const GENDER_LABEL: Record<Gender, string> = { FEMININO: "Feminino", MASCULINO: "Masculino", UNISSEX: "Unissex" };
/** No infantil, feminino/masculino viram menina/menino. */
export const KIDS_GENDER_LABEL: Record<Gender, string> = { FEMININO: "Menina", MASCULINO: "Menino", UNISSEX: "Unissex" };

/** Nome do gênero na URL (`feminino`) conforme a faixa: "Menina" no infantil, "Feminino" no resto. */
export function genderName(slug: string, kids: boolean) {
  const key = slug.toUpperCase() as Gender;
  return (kids ? KIDS_GENDER_LABEL : GENDER_LABEL)[key] ?? slug;
}

/** Rótulo do produto: "Feminino", "Infantil · Menina"… */
export function segmentLabel(ageGroup: AgeGroup = "ADULTO", gender: Gender = "UNISSEX") {
  return ageGroup === "INFANTIL" ? `Infantil · ${KIDS_GENDER_LABEL[gender]}` : GENDER_LABEL[gender];
}

/** Título da seleção com uma faixa e/ou um gênero ("Feminino", "Infantil · Menina", "Infantil"); vários: nada. */
export function segmentTitle(faixa: string[], genero: string[]) {
  if (faixa.length > 1 || genero.length > 1) return undefined;
  const kids = faixa[0] === "infantil";
  const gender = genero[0] ? genderName(genero[0], kids) : undefined;
  if (kids) return gender ? `Infantil · ${gender}` : "Infantil";
  return gender ?? (faixa[0] === "adulto" ? "Adulto" : undefined);
}

/** Endereço de um atalho de público: a faixa e o gênero que ele guarda, somados à seleção (`selo`…). */
export function audienceHref(audience: { ageGroup?: AgeGroup | null; gender?: Gender | null }, base: Record<string, string> = {}) {
  const query = new URLSearchParams(base);
  if (audience.ageGroup) query.set("faixa", audience.ageGroup.toLowerCase());
  if (audience.gender) query.set("genero", audience.gender.toLowerCase());
  return query.size ? `/produtos?${query}` : "/produtos";
}
