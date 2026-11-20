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

Prompt final (ImageGen integrada, usando a fotografia enviada por Rafael como
referência obrigatória de identidade e Roberto Justus apenas para estilo):

> Create a very caricatured recognizable full body game NPC of Duda Mendonça.
> Match the man in the supplied photo: very bald shiny high forehead and crown,
> sparse short gray hair only at sides, heavy broad round face, small deep set
> serious eyes, sagging eyelids, large fleshy nose, pursed thin lips, broad jowls
> and double chin, very short salt-and-pepper stubble beard along jaw and chin.
> No thick mustache, no glasses, no full head of hair. Exaggerate the bald
> forehead, heavy cheeks, skeptical calculating expression and jowls. Painted
> realistic detailed texture like Roberto Justus. Enormous head, short stocky
> small body, dark blazer over open collar charcoal shirt, black trousers and
> shoes. Standing front facing, arms relaxed down, no hand in face. Full body
> inside square canvas with transparent margins. No text, props or scenery.

## Áudio

`apps/sessao/public/assets/audio/aplausos.wav` é um trecho de quatro segundos
de aplausos CC0, com fades. Origem e licença em `audio/CREDITS.md`.
Cada propaganda toca o efeito quando começa a aparecer na TV, inclusive as
propagandas enfileiradas de outros jogadores. Usa o canal normal de efeitos,
respeitando volume e mudo; não toca ao apenas abrir o catálogo.
