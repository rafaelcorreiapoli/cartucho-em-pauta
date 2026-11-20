# Portraits de itens e produtos

Leia também o [fluxo obrigatório](README.md). Aplica-se às imagens de produtos
na loja, equipamentos, alimentos e itens do inventário/HUD. É ilustração de
objeto para catálogo, distinta do ícone de interface e do sprite no mapa.

## Referências visuais

Caminhos a partir da raiz do repositório:

- `apps/sessao/public/assets/retrato-raio-x.webp` e
  `retrato-visao-noturna.webp`: equipamentos do Apoio Técnico.
- `apps/sessao/public/assets/retrato-colete.webp` e `retrato-maleta.webp`:
  tecido/couro, volume e apresentação de objetos carregáveis.
- Masters de mesmo nome em `apps/sessao/dev/hires-world/masters/` para observar
  pintura, textura e contornos sem depender do tamanho pequeno de entrega.
- Para alimentos, abra também `apps/sessao/food-portraits.md` e a xícara do
  catálogo como referência da família.

Antes de gerar uma capa de invisibilidade para a loja, abra os portraits do
Raio X, da Visão noturna e do Colete. O antigo ícone vetorial da capa,
um manto triangular com estrela e preenchimento plano, exemplifica um
desenho fora desse padrão e não é referência aprovada.

## Direção de arte

- Um objeto principal, isolado, com acabamento raster ilustrado e pintado,
  volume convincente e contorno escuro. Ele deve parecer parte do mesmo
  catálogo que Raio X e Visão noturna.
- Perspectiva em três quartos ou vista de produto compatível com a família.
  Dê espessura, dobras, costuras, encaixes e sobreposições coerentes com a peça.
- Materiais legíveis: metal tem planos e reflexos; couro/tecido têm dobras,
  textura e sombra; vidro usa reflexos e transparência localizados.
- Luz modelada e contraste suficiente para ler a silhueta em um slot pequeno.
  Use cor e reflexos conforme o material e os produtos vizinhos, sem um glow
  externo que apague o contorno.
- Objeto centralizado com margem transparente, peso visual e ocupação do
  quadro semelhantes aos itens da mesma categoria. Partes importantes cabem
  inteiras na imagem, mesmo com o recorte real do card.
- Fundo genuinamente transparente. Preço, nome, tecla, borda, seleção e fundo
  verde pertencem à interface, não à imagem do produto.

## Guardrail de estilo

Um contorno geométrico de capa com preenchimento translúcido e uma estrela
pode comunicar a ideia, mas não atende ao catálogo pintado. Desenhe uma peça
com forma, material, volume e acabamento compatíveis com os equipamentos
existentes. O fato de o gameplay usar um corpo genérico vazado não transforma
a imagem de venda em símbolo abstrato, avatar ou frame de animação.

A escolha do formato final também não muda isso: converter um SVG plano para
WebP mantém o mesmo desenho fora do padrão. Emblemas, pictogramas, emoji,
vetores planos e render fotográfico de produto não substituem essa família
ilustrada. Motivos simbólicos podem existir como detalhes pintados da peça.

## Integração

- Confira o campo `portrait` em `apps/sessao/src/gameplay.ts` ou na definição
  específica do produto e seus consumidores em `market-panel.tsx` e no HUD.
- Consulte dimensões, alpha e formato exigidos em `src/gameplay.test.ts` e o
  registro `src/world-assets.json`. Nem todo lote usa o mesmo tamanho.
- Entregue WebP com alpha conforme o contrato existente. Preserve proporção;
  redimensionar não deve achatar, cortar ou compensar um enquadramento ruim.
- Se houver variantes, consulte o [pipeline de interface](../../../apps/sessao/dev/hires-world/README.md)
  e preserve o mesmo master, enquadramento e proporção entre resoluções.

## Critérios de conclusão

- Abra o card na loja real, ao lado de pelo menos dois produtos existentes da
  mesma categoria. Compare pintura, volume, contorno, perspectiva e escala;
  ver a imagem isolada sobre transparência não conclui a revisão.
- Abra também o item no inventário/equipamento: silhueta e detalhe principal
  continuam reconhecíveis no menor tamanho usado.
- Confira alpha em fundo claro, escuro e verde da loja, sem retângulo,
  quadriculado desenhado, halo claro ou fundo residual.
- A captura lado a lado e o prompt/referências usados acompanham a entrega.
  Se a imagem parecer de outra biblioteca de ícones, refaça a arte antes de
  finalizar, mesmo que os testes de arquivo tenham passado.
