# Duda Mendonça — campanhas políticas

NPC fixo atrás da mesa da Sala de Imprensa. Clicar nele ou usar a ação
“Contratar campanha · Duda Mendonça” abre o catálogo existente. Os formatos,
preços, popularidade e validações eleitorais continuam sendo os de `elections.ts`.
João Santana continua sendo o assessor fantasma.

## Arte

Arquivo: `apps/sessao/public/assets/duda-mendonca.webp`, 256 × 256, transparência,
WebP sem perdas. NPCs fixos usam uma pose frontal, sem folhas de caminhada,
golpe ou queda. Gerado pela ferramenta integrada ImageGen; referência de
estilo: `roberto-justus.webp`. Normalização de resolução com Pillow.

Prompts usados:

1. Create a game NPC sprite for Infiltrados using roberto-justus.webp only as
   reference for painted caricature style, full body proportions and transparent
   framing. Subject: Brazilian political marketer Duda Mendonça, older stocky
   man, dark blazer over light open-collar shirt, dark trousers and shoes.
   Single full body standing facing forward, hands relaxed. Oversized caricature
   head and small body, detailed painted realistic texture. Transparent
   background, no text, no props.
2. Correct the identity to Duda Mendonça: remove glasses and beard completely,
   keep thick dark gray mustache, round chubby clean-shaven cheeks and chin,
   fuller combed-back salt-and-pepper hair with receding temples, not bald top.
   Keep full body painted caricature style, dark blazer, open collar,
   proportions and transparent background. No text.

## Áudio

`apps/sessao/public/assets/audio/aplausos.wav` é um trecho de quatro segundos
de aplausos CC0, com fades. Origem e licença em `audio/CREDITS.md`.
Cada propaganda toca o efeito quando começa a aparecer na TV, inclusive as
propagandas enfileiradas de outros jogadores. Usa o canal normal de efeitos,
respeitando volume e mudo; não toca ao apenas abrir o catálogo.
