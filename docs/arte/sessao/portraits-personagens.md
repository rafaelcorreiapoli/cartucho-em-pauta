# Portraits de personagens

Leia também o [fluxo obrigatório](README.md). Aplica-se a avatares, bustos e
retratos de pessoas usados em seleção, HUD e diálogos. Não confundir com o
corpo animado no mapa: consulte [personagens](personagens.md) quando necessário.

## Referências visuais

Caminhos a partir da raiz do repositório:

- `apps/sessao/public/assets/retratos-elenco.webp`: composição e identidade do
  elenco; examine pelo menos duas células, além da pessoa relacionada à tarefa.
- `apps/sessao/dev/hires-world/masters/cast-portrait-0.webp` e os demais
  `cast-portrait-*.webp`: acabamento dos bustos individuais.
- `apps/sessao/public/assets/retrato-daniel-vorcaro.webp` e
  `retrato-roberto-justus.webp`: família de retratos para diálogos de NPCs.

Use a identidade canônica da pessoa e a família de interface em que o retrato
será exibido. Não importe automaticamente a direção de arte de outro jogo do
monorepo, mesmo quando representar a mesma pessoa.

## Direção de arte

- Caricatura pintada com rosto reconhecível, modelagem de volumes e textura de
  pele, cabelo e tecido. Exagero e expressão seguem a sátira do elenco.
- Retrato de cabeça e ombros/busto, rosto como foco, expressão clara em tamanho
  pequeno. Reproduza a ocupação do quadro e o corte de ombros dos vizinhos.
- Preserve traços individuais, faixa etária, cabelo, barba, roupa e acessórios
  relevantes à identidade canônica. Uma nova expressão continua sendo a mesma
  pessoa; um rosto genérico não substitui um retrato de identidade.
- Luz e contraste modelam os planos do rosto. Mantenha acabamento ilustrado,
  cores e recorte compatíveis com os retratos existentes.
- Fundo transparente para o recorte usado pela interface, sem cenário, moldura,
  texto, nome, badge ou iluminação de fundo incorporados à imagem.

## Integração

- Confira `apps/sessao/src/ui/character-portrait.tsx`, os estilos `.portrait`
  e a definição de NPC em `src/npcs.ts` conforme o consumidor.
- No atlas, preserve índice, tamanho de célula, ordem e margens das outras
  pessoas. Confira o recorte aplicado pelo CSS, não apenas a folha inteira.
- Preserve a identidade entre retrato e corpo no mapa, sem usar um frame
  ampliado de caminhada como substituto de um busto pintado.
- Para variantes, consulte o [pipeline de interface](../../../apps/sessao/dev/hires-world/README.md)
  e derive os tamanhos da mesma arte, sem gerar um rosto por resolução.

## Critérios de conclusão

- Reconhecimento da pessoa e expressão legível no menor tamanho de HUD usado.
- Comparação com dois portraits vizinhos confirma pintura, escala do rosto,
  corte de ombros, contraste e ocupação semelhantes.
- Cabeça, cabelo e acessórios relevantes permanecem dentro do recorte real;
  nenhuma célula vizinha aparece no atlas/CSS.
- Transparência limpa nas bordas do cabelo e dos ombros sobre o fundo da UI.
