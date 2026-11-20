# Sprites de personagens

Leia também o [fluxo obrigatório](README.md). Aplica-se ao elenco jogável,
visitantes, NPCs e transformações que apareçam como corpos no mapa.

## Referências visuais

Caminhos a partir da raiz do repositório:

- `apps/sessao/public/assets/characters-hd/lula-walk-256.webp` e
  `bolsonaro-walk-256.webp`: proporções, volume pintado e caminhada do elenco.
- `apps/sessao/public/assets/nestor-cervero-walk.png`: família dos visitantes;
  use os masters/variantes correspondentes para observar detalhes maiores.
- Para uma nova ação, abra a caminhada do próprio personagem e a ação
  equivalente de alguém do elenco. O rosto vem da primeira; a pose, da segunda.

## Direção de arte

- Caricatura pintada com rosto detalhado e reconhecível, cabeça grande e corpo
  curto. Compare altura da cabeça, largura do tronco e tamanho das mãos/pés
  com dois integrantes do elenco antes de definir as proporções.
- Corpo inteiro, pés apoiados no mesmo plano e perspectiva compatível com o
  mapa. Preserve cabelo, roupa, acessórios e traços de identidade entre poses.
- Modele o rosto, tecido e volumes com luz e sombra. O resultado precisa
  pertencer à mesma família ilustrada das referências, inclusive no perfil.
- Silhueta legível na escala do mapa; mãos e pés articulados, sem aparência
  de boneco geométrico ou pictograma de sinalização.

## Animação e contrato

- Confira `apps/sessao/src/character-art.ts`, `adaptive-character-art.ts` e
  `world-art.ts` antes de escolher grade, resolução e direção dos frames.
- A caminhada padrão do elenco usa quatro colunas e três linhas: frente,
  direita e costas; esquerda é espelhada. Ações especiais podem ter quatro
  direções explícitas ou outra grade: siga o consumidor daquela ação.
- Mantenha escala, eixo da cabeça e linha dos pés estáveis entre células.
  Reserve margem para braços, pernas e ferramentas sem invadir a célula vizinha.
- A caminhada alterna avanço das pernas e balanço dos braços, com transferência
  de peso. Quatro imagens da mesma pose ou uma figura apenas deslizando não
  constituem ciclo de caminhada.
- Confira movimento, parada, troca de direção e corrida. A mudança de velocidade
  altera o ritmo, preservando proporções e alinhamento.
- Veja o [pipeline do elenco](../../../apps/sessao/dev/hires-cast/README.md)
  antes de exportar variantes. Cada tamanho deriva do mesmo master.

## Transformações e anonimato

- Uma transformação anônima usa um personagem genérico próprio, comum a todos;
  não reaproveita rosto, cabelo ou roupa de quem ativou o efeito.
- Um corpo vazado mantém anatomia, proporções e caminhada do elenco. O cenário
  aparece através dos espaços vazados; apenas reduzir a opacidade de um rosto
  reconhecível não oculta identidade.
- Confirme separadamente quais sinais o efeito oculta ou preserva. Na capa:
  nome oculto, maleta carregada visível e fumaça da corrida preservada.
- A arte da transformação no mapa não é referência de estilo para a imagem
  do produto na loja; esta exige o [guia de itens](portraits-itens.md).

## Critérios de conclusão

- Comparação lado a lado no mapa confirma proporções, pintura, perspectiva e
  apoio dos pés compatíveis com o elenco.
- Ciclo assistido em todas as direções exigidas, sem tremor de escala,
  identidade mudando, membros cortados ou frames vazando para outras células.
- Nome, equipamentos e efeitos aparecem conforme a regra solicitada, inclusive
  em fotos/câmeras quando aplicável.
- Confira o asset no laboratório `/sprites.html` quando estiver registrado;
  uma animação especial também precisa ser observada no seu fluxo real.
