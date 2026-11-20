# Japonês da Federal — sprites

Assets gerados com ImageGen integrada, com fundo transparente, no estilo de
caricatura pintada do elenco. Frames de 128 × 128 pixels, indexados por linha.

| Arquivo em `apps/sessao/public/assets/` | Tamanho | Linhas | Colunas |
| --- | --- | --- | --- |
| `japones-federal-walk.png` | 512 × 384 | Frente, direita, costas | Quatro fases de caminhada |
| `japones-federal-door-breach.png` | 512 × 512 | Frente, direita, costas, esquerda | Quatro fases de arrombamento |

Na caminhada, espelhar o perfil direito para olhar à esquerda, como no elenco.
No arrombamento, cada direção tem seus próprios quatro frames; não usar a
folha antiga de cofre, que só contém a vista de costas. A porta não faz parte
da arte: deve continuar sendo desenhada pelo mapa.

Referências: `nestor-cervero-walk.png` para escala, estilo e organização da
caminhada; `sergio-moro-safe-breach.webp` para a ação de arrombamento. A folha
de caminhada gerada foi usada como referência de identidade no arrombamento.
As saídas foram reduzidas com `sips`, preservando o canal alfa.

Correção de identidade: ambas as folhas usam óculos escuros de lentes opacas
e armação preta no estilo Wayfarer, conforme a foto fornecida pelo Rafael.
As folhas originais foram editadas com ImageGen preservando poses e grade.
Prompt da correção: substituir apenas os óculos transparentes pelos óculos
escuros da foto em todos os frames frontais e laterais; preservar identidade,
roupa, ferramenta, direções, proporções, alinhamento e transparência.

## Prompts finais

Caminhada:

> Game sprite sheet of Newton Ishii, known in Brazil as Japonês da Federal,
> walking. Match reference image's painted caricature style, large head and
> small full body, exact 4 columns and 3 rows layout. Character has short gray
> black hair, rectangular glasses, dark police vest and dark trousers and shoes.
> 12 full body frames total: first row four walking cycle phases facing viewer;
> second row four walking cycle phases facing right; third row four walking
> cycle phases facing away. Equal square cells, consistent size and baseline,
> all limbs inside each cell. Transparent background. Reference is style and
> layout only. No scenery, no captions. Output landscape 4:3.

Arrombamento:

> Nonviolent video game animation sprite asset: Japonês da Federal, Newton
> Ishii, same character as reference 1, using a handheld pry tool to open a
> stuck door. No people being attacked, no fighting, no injuries. Reference 1
> supplies identity, black vest, glasses and caricature art style. Reference 2
> supplies existing game door opening hand and body motion. Generate a square
> transparent sprite atlas, exactly 4 columns by 4 rows, 16 full body sprites.
> Four animation phases per row showing hands applying and releasing pressure
> on the tool to open the door. Door itself omitted, just character and tool.
> Row 1 facing camera, row 2 profile facing right, row 3 back facing camera,
> row 4 profile facing left. Show all four orientations explicitly. Preserve
> exact character identity, head to body proportions, outfit and scale
> throughout. Feet aligned within equal cells, entire body and tool inside
> each cell with clear margins. Transparent background, no grid lines, no
> captions, no scenery.

## Addon integrado

A opção **Japonês da Federal** fica em Configurar partida → Addons, desligada
por padrão. Só o anfitrião pode alterá-la, antes de iniciar. O tutorial não
ativa a ronda. A configuração permanece disponível para a revanche.

O NPC é independente dos visitantes: não ocupa o limite, não tem carteira,
mandato, salário ou interação de roubo. A ronda usa o mapa e a navegação
existentes, sorteando um gabinete diferente a cada entrada. O agente não é
um alvo de combate e continua a ronda durante a partida; a contagem regressiva
que congela a exploração também pausa seus movimentos.

Portas abertas permitem a entrada. Portas fechadas e destrancadas são abertas.
Nas trancadas, ele usa a capacidade máxima de arrombamento já existente:
5 segundos nos níveis 1–3, 9 no nível 4 e 15 no nível 5. A porta fica arrombada
pelo prazo normal de 30 segundos. As quatro linhas da folha de arrombamento
correspondem às quatro direções de movimento, sem espelhamento da ação.

A checagem ocorre somente ao cruzar para dentro do gabinete. Se alguém ainda
estiver embolsando dinheiro naquele gabinete, a ação é cancelada, todas as
maletas carregadas são apreendidas e o jogador vai à Sala de Isolamento por
10 segundos reais, inclusive durante votações. O temporizador nativo da sala
libera a detenção mesmo quando o relógio legislativo está pausado. Objetos pessoais, dinheiro já embolsado e maletas guardadas no
armário são preservados. A apreensão entra nas saídas da contabilidade da
partida. Essa prisão não aplica a perda de popularidade do afastamento.

Terminar de embolsar até o instante da entrada permite escapar. Começar a
embolsar depois da entrada não gera flagrante por proximidade. Com ou sem
flagrante, o NPC imediatamente escolhe o próximo gabinete e continua a ronda.

Implementação: `server/FederalPatrol.ts` controla navegação e portas;
`Gameplay` verifica o flagrante e apreende as maletas; `PlenaryMatch` e
`PoliticalEconomy` aplicam a detenção; `SessionRoom` sincroniza o lobby e usa
a transferência e a liberação existentes da solitária. As folhas são
carregadas em `src/game.ts` e a animação direcional é definida em
`src/federal-patrol.ts`.
