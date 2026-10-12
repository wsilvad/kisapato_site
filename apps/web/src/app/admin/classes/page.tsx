"use client";

import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default function ClassesAdmin() {
  return (
    <TaxonomyAdmin
      resource="classes"
      title="Classes"
      hint="A classe agrupa as categorias (ex.: Calçados e Acessórios). Cada categoria pertence a uma classe."
      noun="classe"
      newLabel="Nova"
      usage={{ key: "categories", label: "categorias" }}
      deleteMessage="Excluir classe?"
      placeholder="Calçados"
      activatable={{ warn: (name, n) => `Desativar a classe “${name}”? As ${n} categoria(s) dela e todos os produtos dessas categorias deixam de aparecer na loja (continuam cadastrados e voltam ao reativar).` }}
    />
  );
}
