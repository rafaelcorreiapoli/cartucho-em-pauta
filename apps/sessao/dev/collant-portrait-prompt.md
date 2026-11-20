# Portrait do Collant da Invisibilidade

Ferramenta: ImageGen integrada, com fundo transparente.

Referência de forma e proporções: `public/assets/capa-invisibilidade-walk.webp`,
o sprite genérico já usado no mapa. Referências de pintura e contorno, em
`dev/hires-world/masters/`: `retrato-colete.webp` e `retrato-raio-x.webp`.
A proposta exagera a cabeça, encurta o corpo e amplia o puxador do zíper para
dar um caráter cômico ao traje justo, mantendo volumes pintados legíveis.

Master: `dev/hires-world/masters/retrato-collant-invisibilidade.webp`.
Entrega base: `public/assets/retrato-collant-invisibilidade.webp`, 256 × 256.
Dimensões nativas e hash da geração estão em `dev/hires-world/manifest.json`.
Variantes 128/256/512 registradas em `src/world-assets.json`, derivadas do mesmo
master pelo pipeline existente:

`uv run --with pillow --with numpy --with scipy python dev/hires-world/build.py retrato-collant-invisibilidade`

O nome aparece como Collant da Invisibilidade na loja, no HUD e no feedback.
O efeito usa o sprite existente, com nome oculto, maleta visível e fumaça da
corrida preservada. Preço, slot de tronco, tecla I, duração e recarga seguem
as regras existentes.

## Prompt final

> Use case: stylized-concept. Asset type: single equipment portrait for the shop/inventory of a COMICAL 2D political caricature game. Primary request: Collant da Invisibilidade, an absurdly snug full-body invisibility leotard/wetsuit, matching the shape of the game's anonymous glass character. Input 1 sprite sheet is SHAPE/PROPORTION reference only: big rounded generic head covering about 40 percent of the height, short compact torso, stubby articulated arms and legs, rounded hands and feet. Ignore the sheet's transparency noise/artifacts, do not copy its grid. Inputs 2 armored vest and 3 scanner are PAINTING/CONTOUR references only: illustrated dark contours, stylized modeled volume, controlled highlights and readable game-object silhouette. Create ONE empty hooded stretchy bodysuit, long sleeves, gloves, full legs and foot coverings all integrated, in a playful three-quarter front view. Large featureless rounded hood with empty face opening, slightly round ordinary belly, small slightly bent knees, arms gently away from body. Clothing only, no actual human wearer, skin, face, muscles or identifying features. A conspicuously oversized zipper pull down the chest and chunky painted seams at cuffs/ankles make it look like ridiculous overly snug diving/dancewear. The humor comes from the caricature proportions and awkward rubber-suit shape, NOT a heroic superhero costume. Silvery pale teal/cyan semi-transparent stretch material, glossy cartoon edge highlights suggesting the same glass outline seen on the map; keep strong darker blue-teal drawn contours so the item is readable against the shop's dark green UI. Simplified bold 2D PAINTED cartoon volumes, a small number of large shadow shapes, hand-painted finish; charmingly goofy, comical and caricatural. NO photoreal cloth texture, tiny fabric weave, photographic studio rendering, solemn fantasy illustration, medieval cloak, flowing cape, realistic athlete anatomy, or polished 3D realism. No text or logo. ONE coherent product, centered, complete head-to-toe inside square canvas, transparent margins around it, roughly 80 percent canvas height. Real RGBA transparent background; no floor, backdrop, mannequin stand, hanger, shadow outside the item, magical sparkles, symbols, extra props or grid. Not a flat geometric pictogram either: retain rich illustrative shading like the catalog references while making the caricature exaggerated. Square 1024x1024.
