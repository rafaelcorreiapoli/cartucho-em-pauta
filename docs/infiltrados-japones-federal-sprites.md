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

## Escopo

Esta entrega contém as artes; a integração do addon fica para a implementação
da mecânica. Regra discutida: ativação no lobby, ronda aleatória de gabinetes,
arrombamento com o tempo e resistência existentes, flagrante apenas na entrada,
solitária e perda das maletas carregadas, seguida de continuação da ronda.
A duração de 10 segundos de prisão foi proposta, ainda sujeita a ajuste.
