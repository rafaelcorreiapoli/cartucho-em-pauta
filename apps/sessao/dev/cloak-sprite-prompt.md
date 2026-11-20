# Sprite do Collant da Invisibilidade

Gerado com a ferramenta ImageGen integrada. Referência de proporção e perspectiva: `public/assets/characters-hd/lula-walk-256.webp`. A identidade do personagem de referência não faz parte do sprite.

Arquivo final: `public/assets/capa-invisibilidade-walk.webp`, folha de 1024 × 1024 pixels, quatro colunas e quatro linhas (frente, direita, costas, esquerda), células de 256 × 256. Conversão para WebP lossless e normalização de tamanho via cwebp.

Brief da geração: homem adulto genérico sem rosto, cabelo, barba ou roupa identificável, proporções caricatas médias do elenco, cabeça com aproximadamente 43% da altura. Contorno de vidro prata/ciano e interior vazado. Quatro poses alternadas de caminhada por direção. Fundo transparente, sem chão, texto ou grade.

Prompt final de refinamento, aplicado à folha gerada:

> Precise transparency edit for a production spritesheet. Preserve the exact 4x4 grid, positions, proportions, all walking poses, directions and delicate silhouette outline of the supplied image. REMOVE ALL WHITE BACKGROUND AND ALL WHITE OR BLUE FILLED INTERIORS OF EACH PERSON. Output a real RGBA PNG where the background pixels and the inside of the heads torsos arms and legs have alpha EXACTLY ZERO. Only keep the thin illustrated silver-cyan outer glass silhouette contours and a few slim glass reflected highlight lines near their edges. Every character must be HOLLOW/EMPTY, like an outline drawing made of glass with see-through empty center, not a solid glass mannequin. No white canvas, no checkerboard illustration, no opaque white or milky body surface. No large cast shadows or glow fog. Preserve walking movement and 16 equally spaced cells exactly. Keep the body's actual contour lines visible rather than fading the whole sheet. Background and all enclosed interiors genuinely TRANSPARENT, alpha=0.
