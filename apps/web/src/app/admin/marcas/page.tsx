"use client";

import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default function BrandsAdmin() {
  return (
    <TaxonomyAdmin
      resource="brands"
      title="Marcas"
      hint="Cadastre as marcas que a loja vende. No cadastro do produto você escolhe a marca por pesquisa, ou cadastra uma nova na hora."
      noun="marca"
      newLabel="Nova"
      usage={{ key: "products", label: "produtos" }}
      deleteMessage="Excluir marca?"
      placeholder="Vizzano"
      activatable={{ warn: (name, n) => `Desativar a marca “${name}”? Os ${n} produto(s) dela deixam de aparecer na loja (continuam cadastrados e voltam ao reativar).` }}
    />
  );
}
