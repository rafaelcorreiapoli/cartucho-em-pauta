# Arte da V1

Gerada com a ferramenta integrada `image_gen`. Os PNGs finais estão em `apps/web/public/assets/`; o jogo não depende do diretório de geração do Codex.

## Direção e prompts

Os prompts finais pediram estes três entregáveis:

1. **battlefield.png** — Production-ready 2D browser strategy game battlefield BACKGROUND ONLY, 1536x1024. Original premium hand-painted cartoon Brazilian capital Brasília theme; oblique overhead view with front faces visible; warm daylight, sage grass, ochre horizontal walkway at 58% height. Open upper-left and upper-right construction areas, National Congress skyline in top 20%, tropical foliage and pink flowering trees framing the edges. No characters, UI, text or main bases. Symmetric gameplay layout with organic decorative asymmetry.
2. **units.png** — Production game sprite atlas on genuine transparent background, 1536x1024, exact uniform 4 columns × 2 rows (384×512 cells), full bodies, common baseline, facing right. Consistent hand-painted cartoon art, dark forest outlines, compact bodies and expressive large heads. First row: red-capped rural activist with placard, older union organizer with megaphone, red loudspeaker truck, Black bearded intellectual hero in red jacket holding a book. Second row: finance worker in green vest with briefcase, older yellow-shirt smartphone user, green/yellow loudspeaker truck, young green-shirt microphone hero. No text, labels or grid lines.
3. **buildings.png** — Production 2D building sprite atlas on genuine transparent background, 1536x1024, uniform 4×2 grid. Oblique overhead perspective with front facade and roof visible, dark forest outlines, cream/coral/sage/mustard palette, light from upper left. First row: red-roof committee, radio station with antenna, loudspeaker garage, red modernist headquarters. Second row: green finance office, messaging center with satellite dish, green/yellow garage, green modernist headquarters. Full buildings, no text, grid, people or ground tiles.

As duas folhas são consumidas diretamente como atlas regulares no Phaser e como regiões de imagem no HUD. O fundo transparente dos atlas foi preservado. As folhas iniciais são usadas nos retratos do HUD. A batalha usa as folhas animadas descritas abaixo.

Impactos POW/BAM, sangue e projéteis são construídos em runtime com Graphics, Text, Tween e ParticleEmitter do Phaser. Não foram gerados quadros separados desses efeitos.

## Fontes e ícones

- Barlow Condensed e DM Sans: arquivos locais em `assets/fonts`, licenças SIL Open Font License incluídas nesse diretório.
- Phosphor: pacote `@phosphor-icons/react`, licença MIT.

## Folhas de animação

`left-animation.png` e `right-animation.png`: geradas com a folha inicial `units.png` como referência explícita de identidade, estilo e proporções. Cada imagem tem 1536×1024 pixels, 8 colunas por 4 linhas, células de 192×256. Cada linha corresponde a infantaria, unidade à distância, veículo de cerco e herói.

Prompt de animação: “Use the attached character atlas as a strict identity/style reference. Create a true animation sprite sheet for the four red [or green/yellow] characters only. Exact 1536×1024, 8 equal columns × 4 equal rows, transparent background, one character per row facing right. Columns 1–4: sequential walk poses, alternating legs/arms, fixed head height and baseline, no vertical bobbing; trucks rotate wheels. Columns 5–6: attack windup and strike with the character's prop. Columns 7–8: falling then lying on the ground; trucks tilt and collapse. Preserve reference faces, clothes, colors, proportions and cartoon style. Every pose stays inside its 192×256 cell with transparent margins. No text, labels, grid, particles or impact lettering.”

Os frames de ataque são disparados pelos eventos reais da simulação. A remoção da unidade dispara os frames de morte, seguidos de fade. A posição vertical de caminhada permanece fixa e as barras de vida ficam acima da altura máxima do personagem.

## Cenário aberto e sombras

`battlefield-open.png` substitui o cenário de praça no jogo; o arquivo anterior foi preservado. Prompt: “New clean playable 2D RTS ground background,1536×1024, oblique orthographic overhead view, same scale throughout. Open Brazilian countryside frontier, subtle short sage/olive grass, warm tan dirt road across the full width at58% height, road16% high. Empty upper/lower construction areas. Tiny pebbles and grass tufts, restrained detail, soft sun upper left, no perspective vanishing point, horizon or sky. No trees, oversized foliage, benches, flowers, architecture, buildings, characters, text or UI. Warm earthy hand-painted terrain matching reference rendering language.”

As sombras de contato são texturas procedurais leves do Phaser, com elipses translúcidas sobrepostas. Personagens e veículos têm o pivô vertical alinhado ao pé/roda opaco de cada frame, medido com Sharp e registrado em `sprite-origins.json`. A profundidade usa a coordenada desse contato com o chão. O script `bun scripts/sprite-metadata.ts` recalcula as âncoras após substituir as folhas, sem alterar os PNGs.

## Obras e popularidade

`construction.png`: folha de 4 colunas × 2 linhas, células 384×512. Quatro etapas genéricas de obra com duas poses por etapa, de fundação a andaimes. Renderizada exclusivamente no mapa; o HUD mantém o retrato do prédio final.

`civic.png`: duas células 768×1024, feira cultural vermelha e estádio verde/amarelo, com fundo transparente e perspectiva compatível com os prédios existentes.

A folha `buildings.png` foi reorganizada em células regulares com margem transparente. Os desenhos originais tinham divisórias irregulares, que cortavam a garagem e incluíam parte do prédio vizinho.

A conclusão de ciclos usa partículas nativas do Phaser, pulso luminoso, onda no chão e texto flutuante. O contador autoritativo `completedCycles` evita efeitos falsos quando a produção está bloqueada ou o jogador entra na partida.

Música e efeitos: fontes e licenças em [audio-assets.md](audio-assets.md).

## Regiões de base gramadas

`battlefield-regions.png` substitui o cenário aberto no mapa. Gerado com `battlefield-open.png` como referência de estilo e paleta. Prompt: “Same hand-painted grass/ochre palette, subtle small-scale details, oblique overhead orthographic perspective, no horizon or objects. Wide 2:1 RTS composition. Large uninterrupted grassy base regions occupy left 35% and right 35% from top to bottom. A single short warm tan dirt connecting road only spans x35%–65%, centered at y58%, thickness10% of image height, rounded tapering ends blending into grass. No road reaching any image edge. No buildings, trees, benches, flags, labels, UI or text.”

Os retratos dos prédios no HUD usam SVG como janela de recorte de PNG, com `preserveAspectRatio="xMidYMid meet"` e viewport interno isolado. Isso evita deformação e vazamento das células vizinhas mesmo em botões largos.


## Moradias e trabalhadores

`housing.png`: folha transparente 1536×1024, duas células 768×1024. Prompt: “Cartoon RTS housing atlas, two isolated buildings, warm hand-painted architecture, dark olive outlines, oblique orthographic front-right view. Left: collectively occupied patched red-brick apartment house, improvised awnings, rooftop water tanks, laundry lines, vegetable planters and red fabric without words. Right: tiny luxury green-glass condominium, gold accents, exaggerated gate, rooftop pool, pink flamingo float, palm and balcony treadmill. No people, labels, text, ground, shadows, UI or grid.”

`workers-painted.png`: quatro frames de caminhada por facção, gerados com a folha original `units.png` como referência explícita de identidade visual. Esquerda: operário sindicalizado, boné vermelho, bigode, roupa de trabalho e marmita. Direita: PJ de capacete, camisa social, colete verde, calça bege e maleta. O prompt exige os mesmos contornos escuros, proporções e sombreado pintado das unidades originais. Uma segunda edição removeu o fundo semitransparente preservando personagens e poses.

`bun scripts/prepare-workers.ts <fonte.png>` reorganiza as colunas irregulares em células 384×512, com margens transparentes e escala uniforme. O script verifica o alfa das bordas e recalcula as âncoras dos pés em `worker-origins.json`. A versão vetorial provisória foi removida.

A área de caminhada atrás da base não tem cercado. Rotas cosméticas derivadas do tempo da partida preservam pausas, continuidade e limites da região. A quantidade de sprites só aumenta quando o trabalhador termina o treinamento na base.


## Bancos

`banks.png`: atlas transparente 1536×1024, duas células 768×1024. Referência explícita: a folha original `buildings.png`. Prompt: “Match exact painted RTS architecture, dark olive outlines, warm smooth shading and toy-like front-right orthographic perspective. Left: modest red-and-cream cooperative bank, stone facade, two columns, red awning, vault through doorway, red pennant. Right: same-sized green-and-cream bank, polished small neoclassical facade, tinted glass, restrained gold coin medallion, yellow pennant. Complete buildings centered in separate cells with clear margins. No text, people, ground, shadows or translucent background.”

`academies.png`: atlas transparente 1536×1024, duas células 768×1024, gerado usando `buildings.png` como referência estrita de contornos, sombreado e perspectiva. Universidade vermelha com telhas e pequena ala de biblioteca; instituto verde com livro e engrenagem na fachada. Prédios baixos, mesma escala, margens transparentes, sem textos ou personagens.

`research-class-portraits.png`: portraits de treino à distância e engenharia de cerco, gerados com a mesma referência visual dos demais comandos.

Moradias refeitas em 06/11/2026: `housing.png`, duas células 768×1024, dois pavimentos, formas grandes e contornos grossos com a folha original `buildings.png` como referência estrita. Alfa transparente validado. `scripts/sprite-metadata.ts` também gera `building-origins.json`: base opaca por frame para alinhar as construções, incluindo universidade e base, ao centro de suas sombras. Atualizar esses metadados sempre que substituir folhas de prédios.

`building-tops.json` mede o topo opaco por frame para fixar os ícones de status logo acima do telhado. Controles HTML usam a matriz de projeção da câmera Phaser, mantendo o alinhamento em pan, zoom e redimensionamento.
