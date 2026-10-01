# Plano — E-commerce Ki Sapato

## Objetivo
Construir a primeira versão completa da loja virtual Ki Sapato, em português do Brasil, para calçados, bolsas e acessórios femininos, masculinos e infantis, junto de uma área administrativa segura para gerir o conteúdo da loja. A experiência de compra será mobile-first, editorial, sofisticada e fiel à identidade preta e branca da marca.

## Direção visual
- Usar a logo enviada no cabeçalho e rodapé, além de criar o ícone do navegador a partir dela.
- Aplicar a paleta do protótipo: preto profundo, branco, cinzas neutros e vermelho apenas para promoções.
- Usar Cormorant Garamond em títulos, produtos e preços de destaque; Jost em navegação, textos e controles.
- Manter linhas retas e cantos sem arredondamento, exceto seletores de cor e contador da sacola.
- Incorporar os padrões úteis das referências: faixa promocional, navegação por categorias, imagens grandes de campanha, filtros prioritários por tamanho e cor, preços parcelados e compra rápida no celular.
- Gerar um conjunto visual coerente de imagens para campanha, categorias e catálogo, com foco nos produtos e sem aparência genérica de banco de imagens.

## Estrutura da loja

### Navegação global
- Cabeçalho desktop com faixa promocional, logo, menus Feminino, Masculino, Infantil, Marcas, Lançamentos e Promoções, além de busca, conta e sacola.
- Cabeçalho mobile com menu lateral, busca, logo central e acessos rápidos.
- Rodapé com links, newsletter simulada, formas de pagamento e os dados informados:
  - Av. Cel. Victor Villa Verde, 300, Sala 06 — Pátio Urbano
  - WhatsApp (51) 99811-3318
  - Segunda a sexta, 8h30–18h30; sábado, 8h30–17h
- Estados de foco, textos alternativos e controles acessíveis em toda a loja.

### Home
- Campanha principal com chamada da nova coleção, dois acessos de compra e carrossel preparado para até três banners.
- Categorias Feminino, Masculino e Infantil em três blocos visuais.
- Vitrines de lançamentos e destaques.
- Banner de promoções e faixa de benefícios: frete grátis, retirada na loja, parcelamento e troca fácil.

### Todos os modelos
- Catálogo com busca, ordenação, contador, paginação no desktop e “Carregar mais” no celular.
- Filtros combináveis por gênero, categoria, tamanho, cor, marca e faixa de preço.
- Filtros e ordenação refletidos na URL para permitir compartilhar e restaurar resultados.
- Painel de filtros no celular, estados sem resultados e ação para limpar filtros.

### Produto
- Galeria de imagens, marca, referência, nome, preço, desconto e parcelamento.
- Seletores de cor, tamanho, quantidade e favorito visual.
- Estoque por combinação de cor e tamanho, com numeração indisponível riscada.
- Guia de medidas, cálculo de frete simulado, descrição e políticas em seções expansíveis.
- Produtos relacionados e botão de compra fixo na base do celular.

### Sacola e checkout
- Sacola persistida no próprio dispositivo, com quantidade limitada pelo estoque, remoção de itens e progresso para frete grátis acima de R$ 399.
- Resumo com subtotal, entrega, total e parcelamento em todas as etapas.
- Fluxo completo de demonstração: Sacola → Identificação → Entrega → Pagamento → Pedido confirmado.
- Campos com máscaras e validações claras para CPF, telefone e CEP.
- Entrega simulada com retirada na loja, padrão e expressa.
- Pagamento visual por Pix, cartão em até 6 vezes e boleto, sem transação real.

### Área do cliente
- Login com e-mail e senha e opção Google.
- Perfis com nome, avatar, preferências e dados pessoais básicos.
- Meus pedidos, Endereços e Meus dados, com acesso restrito ao próprio cliente.

### Área administrativa
- Acesso protegido e separado da loja, disponível apenas para usuários com função de administrador.
- Painel geral com atalhos para produtos, categorias, vitrines e campanhas.
- Produtos: criar, editar, ativar, ocultar e excluir; alterar nome, descrição, marca, preços, selo, categoria, gênero, cores, tamanhos e estoque.
- Fotos: enviar, visualizar, reordenar, substituir, definir imagem principal e remover imagens do produto.
- Categorias: criar, editar, ordenar, ocultar e excluir grupos como Feminino, Masculino, Infantil, Sapatos, Bolsas e Acessórios.
- Vitrines da Home: criar, ordenar, ativar, ocultar e remover blocos; definir título, regra de seleção de produtos e quantidade exibida.
- Campanhas de capa: enviar imagens distintas para desktop e celular, editar chamada, texto, botão, destino, período de exibição, ordem e status.
- Formulários com confirmação antes de exclusões e mensagens claras de sucesso ou erro.

## Dados, acesso e regras
- Ativar o Lovable Cloud para autenticação, banco de dados e armazenamento seguro das fotos administradas.
- Criar os 12 produtos iniciais do protótipo, incluindo variações, preços, promoções, selos e estoque, além de exemplos de bolsas e acessórios.
- Armazenar produtos, variações, imagens, categorias, vitrines, campanhas e perfis no banco, permitindo que alterações do painel apareçam na loja.
- Manter funções de usuário em estrutura separada dos perfis e validar permissões no servidor; nunca confiar apenas na interface para autorizar administradores.
- Aplicar regras de acesso para que visitantes leiam somente conteúdo publicado, clientes acessem apenas os próprios dados e administradores gerenciem o catálogo.
- Manter a camada de acesso a dados organizada para futura integração ou sincronização com a API REST existente.
- Formatar todos os valores em reais e aplicar as regras de parcelamento, promoção, frete e estoque descritas no protótipo.
- Persistir a sacola no dispositivo nesta fase; pedidos e pagamentos continuam demonstrativos.

## Rotas
- `/` — Home
- `/produtos` — Catálogo
- `/produtos/$slug` — Produto
- `/sacola` — Sacola
- `/checkout/identificacao` — Identificação
- `/checkout/entrega` — Entrega
- `/checkout/pagamento` — Pagamento
- `/checkout/confirmado` — Pedido confirmado
- `/conta` — Área do cliente
- `/auth` — Entrar e criar conta
- `/reset-password` — Recuperar senha
- `/admin` — Painel administrativo protegido
- `/admin/produtos` — Produtos e fotos
- `/admin/categorias` — Categorias e seções
- `/admin/campanhas` — Capas e vitrines da Home

Cada página terá título, descrição e dados de compartilhamento próprios.

## Detalhes técnicos
- Manter a estrutura atual em TanStack Start, React, TypeScript e Tailwind CSS v4; adaptar a intenção do protótipo sem trocar o roteador do projeto.
- Usar rotas protegidas e validação de sessão para a conta e o painel administrativo, com recuperação de senha e cabeçalho refletindo o estado de acesso.
- Criar componentes reutilizáveis para cabeçalho, rodapé, cards, filtros, galeria, seletores, formulários e resumo do pedido.
- Usar parâmetros de busca tipados para filtros e paginação e segmento dinâmico para o produto.
- Carregar fontes pelo cabeçalho do documento e definir cores como tokens semânticos globais.
- Guardar a logo e as imagens geradas no fluxo de mídia adequado do projeto.
- Respeitar redução de movimento e impedir rolagem horizontal no celular.

## Validação final
- Conferir todos os caminhos, filtros, busca, seletores, sacola e avanço do checkout.
- Testar visualmente em celular e desktop, incluindo menus, painéis, textos longos e botão fixo de compra.
- Verificar acessibilidade básica, ausência de sobreposições e funcionamento sem erros.

## Fora desta fase
- Pagamento, CEP, newsletter e pedidos reais.
- Cupons, transportadora, etiquetas, rastreio e envio de e-mails.
- Integração definitiva com a API existente; a estrutura ficará preparada para ela.
