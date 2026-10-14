"use client";

import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default function AudiencesAdmin() {
  return (
    <TaxonomyAdmin
      resource="audiences"
      title="Públicos-alvo"
      hint="Feminino, Masculino, Infantil… Cada produto pode ter vários públicos e aparece em todos eles nos filtros da loja."
      noun="público"
      newLabel="Novo"
      usage={{ key: "products", label: "produtos" }}
      deleteMessage="Excluir público? Os produtos continuam cadastrados."
      placeholder="Feminino"
      imageHint="Aparece em “Compre por público” na home. Sem foto, o público não aparece lá. Formato vertical, ao menos 800 × 920 px."
    />
  );
}
