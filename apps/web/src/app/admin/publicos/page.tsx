"use client";

import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default function AudiencesAdmin() {
  return (
    <TaxonomyAdmin
      resource="audiences"
      title="Públicos-alvo"
      hint="Atalhos da home (Feminino, Infantil, Menina…). Cada um leva aos produtos de uma faixa etária e/ou gênero; a faixa e o gênero de cada produto são escolhidos no cadastro do produto."
      noun="público"
      newLabel="Novo"
      usage={{ key: "products", label: "produtos" }}
      deleteMessage="Excluir este atalho? Os produtos não mudam."
      placeholder="Feminino"
      segment
      imageHint="Aparece em “Compre por público” na home. Sem foto, o público não aparece lá. Formato vertical, ao menos 800 × 920 px."
    />
  );
}
