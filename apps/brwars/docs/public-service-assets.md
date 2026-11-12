# Serviços públicos: sprites e prompts

Gerados pela ferramenta integrada `image_gen`, com `apps/web/public/assets/buildings.png` como referência visual estrita. Assets finais: `apps/web/public/assets/schools.png` e `apps/web/public/assets/hospitals.png`. Cada atlas mede 1536×1024, duas células 768×1024, esquerda vermelha e direita verde. Transparência real verificada nas margens; âncoras do topo/base calculadas por `scripts/sprite-metadata.ts`. Originais de geração preservados no diretório do Codex.

## Prompt comum exato

Use case: stylized-concept. Asset type: transparent sprite atlas for an existing cartoon RTS. Use attached buildings.png as strict STYLE REFERENCE, NOT edit target. Match exact thick dark olive outlines, simple chunky toy buildings, warm hand-painted cel shading, cream stone trim, blue-green windows, front-right orthographic 3/4 view, subtle humorous oversized architectural symbol. Not photoreal, not detailed gritty illustration. Output ONE landscape 3:2 image, two equal columns. Each column contains ONE complete isolated small building, centered within its tall cell, same apparent size and same bottom baseline. Left faction red-and-cream, right faction green-cream-gold. Same footprint and low silhouette as reference radio building, not tall towers. Generous fully transparent margins all around and between buildings. True transparent alpha background. No ground, shadows, people, text, letters, labels, logos, frame, grid or watermark.

## Sufixos exatos

**schools:** Schools: left a red-roof community school with playful oversized open-book emblem above the front entrance and small schoolyard bell, red pennant; right green-roof private prep school with a gold graduation-cap emblem above entrance and tiny gold pennant. Both only one floor, large simple forms, two classroom windows per side, small shrubs.

**hospitals:** Hospitals: left a red-and-cream community clinic with a broad entrance canopy, a chunky medical heart plaque above door, small rooftop ventilation; right green-and-cream premium clinic with gold medical heart plaque and green entrance canopy. Two low floors maximum, big blue windows, tiny shrubs. Medical heart emblem, no red cross emblem.
