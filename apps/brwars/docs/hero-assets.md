# Elenco de heróis: assets e prompts

Ferramenta: `image_gen` integrada, sem CLI/API externa. Referência de estilo: `apps/web/public/assets/units.png`. Cada personagem tem atlas 1536×1024, quatro colunas por duas linhas, oito células 384×512. Frames 0–3 caminhada, 4–5 ataque, 6–7 derrota. O primeiro frame também fornece o portrait, com o mesmo enquadramento das unidades existentes. PNGs mantêm transparência real e margens; âncoras por frame são calculadas por `scripts/sprite-metadata.ts` em `apps/web/src/hero-origins.json`.

Arquivos finais:
- `apps/web/public/assets/hero-che.png`
- `apps/web/public/assets/hero-stalin.png`
- `apps/web/public/assets/hero-dilma.png`
- `apps/web/public/assets/hero-lulinha.png`
- `apps/web/public/assets/hero-jorginho.png`
- `apps/web/public/assets/hero-pavanato.png`

Jones Manoel e Mamãe Falei conservam seus sprites e portraits originais. Lulinha representa o próprio Lula, confirmado pelo usuário. Jorginho foi mantido à direita conforme solicitado; referência visual do personagem de Fausto Carvalho: [entrevista no UOL](https://www.uol.com.br/universa/noticias/redacao/2025/04/12/desculpa-alguma-coisa-fausto-carvalho.htm).

## Prefixo exato das seis gerações

Use case: stylized-concept. Asset type: 8-frame transparent character animation atlas for existing Brazilian satirical RTS. Attached units.png is STRICT visual style reference only. Match thick dark olive ink outlines, warm hand-painted cel-shading, big expressive heads, short chunky bodies, same cartoon caricature proportions and toy-like clean colors. Output exactly 1536x1024 landscape image: 4 equal columns and 2 equal rows, eight separate 384x512 cells. Exactly one SAME complete character per cell. All frames face RIGHT, orthographic side/3-quarter view. Generous transparent padding in every cell, no clipping across cells. Feet of standing/walking/attack frames aligned near 90% cell height. First row frames 0-3: four distinct walking poses with alternating legs and subtle arms. Second row frames 4-5: wind-up and striking attack with handheld prop; frames 6-7: comical defeat kneeling then lying on side (no gore). Do not write frame labels. True transparent alpha background, NO ground, shadow, glow, colored rectangle, grid, text, logo or watermark. No extra people. Keep costume, face and scale identical in all eight frames. Subject:

## Sujeitos exatos

**che:** Che Guevara caricature, recognizable dark wavy hair, scruffy black beard, black beret with a tiny plain star, olive field jacket, red neck scarf, dark olive trousers and brown boots. Holds a rolled parchment as a comical baton.

**stalin:** Joseph Stalin satirical caricature, very thick dark moustache, slicked gray-black hair, stern exaggerated eyebrows, beige military tunic with red collar accents (no emblems), brown boots, holding a giant red hardback book as a comical striking prop. No weapons.

**dilma:** Dilma Rousseff satirical caricature, short voluminous chestnut bob haircut, expressive determined eyebrows, red blazer over white blouse, dark trousers and black low shoes, holding a wooden pointer and a rolled chart as comical props.

**lulinha:** Lula da Silva as a small playful satirical game caricature nicknamed Lulinha: elderly rounded face, short white hair, thick white beard, red rolled-sleeve jacket, cream shirt, dark trousers, sturdy brown shoes, holding a red-and-cream megaphone as comical melee prop. No writing.

**jorginho:** Jorginho the fictional Faria Limer parody: blond wig with wavy swept hair, exaggerated self-assured grin, tight light blue polo, pink sweater tied over his shoulders, beige shorts above knees, brown boat shoes, holding a beach-tennis paddle as his comic melee prop and a small insulated cup. No brands.

**pavanato:** Lucas Pavanato satirical caricature, young fair-skinned man with thick short dark brown hair swept into a neat quiff, angular face, dark navy blazer, light shirt, beige trousers and dark shoes, holding a smartphone and a chunky gold-colored selfie microphone as comical props. No logos or words.

## Edição de transparência

Cada atlas passou por uma segunda chamada integrada de extração do fundo, usando o atlas gerado como alvo. Prompt aplicado a Che, Stalin, Dilma e Lulinha:

Use case: background-extraction. Edit target: attached 1536x1024 eight-frame game character atlas. Correct ONLY its alpha/transparency: remove ALL gray/beige backdrop, haze, shadows, glow and semi-transparent rectangles outside the dark character outlines. Output exact same 1536x1024 canvas and 4-column 2-row grid. Preserve EVERY character, pose, face, prop, outline, color, pixel location, size and baseline exactly. Do not redraw, move, rescale, crop or add anything. All background pixels, including the gaps between poses and around limbs, must be genuinely fully transparent (alpha zero). Keep solid character interiors fully opaque with clean antialiased edges. NO checkerboard image, no white backdrop, no ghost halo, no labels. The only visible content should be the eight existing characters.

Para Jorginho e Pavanato, mesma instrução de extração com a lista de cores ampliada para “white/gray/green/beige backdrop”; invariantes, grade, dimensões e poses preservados. Originais e edições preservados no diretório de geração do Codex. Assets em uso ficam integralmente no repositório.

## Elenco atual e arte reservada

A Direita usa Mamãefalei, Trump, Bolsonaro e Pablo Marçal. Jorginho não faz parte do catálogo de heróis. Seu atlas foi preservado como `apps/web/public/assets/unit-beach-tennis.png`, com âncoras em `apps/web/src/beach-tennis-origins.json`, para uma futura unidade. Nenhuma unidade de beach tennis é produzida nesta versão. Os caminhos e prompts acima registram a geração original; os ajustes posteriores estão em `hero-roster-update.md`.
