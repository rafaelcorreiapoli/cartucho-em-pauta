# Portrait da capa de invisibilidade

Ferramenta: ImageGen integrada, com fundo transparente. A mudança é apenas na
ilustração da loja/inventário; funcionamento, preço, slot e cooldown permanecem.

Referências de acabamento (masters em `dev/hires-world/masters/`):
`retrato-raio-x.webp`, `retrato-visao-noturna.webp` e `retrato-colete.webp`.
Foram usadas como referência de pintura, contorno, volume, material e luz,
sem reaproveitar a forma dos equipamentos.

Master: `dev/hires-world/masters/capa-invisibilidade.webp`, 1254 × 1254.
Entrega base: `public/assets/capa-invisibilidade.webp`, 256 × 256.
Variantes 128/256/512 registradas em `src/world-assets.json`, exportadas pelo
pipeline existente: `uv run --with pillow --with numpy --with scipy python dev/hires-world/build.py capa-invisibilidade`.

O SVG plano anterior foi removido.

## Prompt final

> Use case: stylized-concept. Asset type: equipment inventory/shop portrait for the 2D satirical game Presidente da Sessão. Primary request: replace a flat icon with a richly PAINTED physical invisibility cloak matching the supplied existing equipment catalog. Input image 1 (scanner), image 2 (goggles), image 3 (armored vest) are visual STYLE references only: match their dark illustrated contours, directional warm light, modeled dimensional volumes, subtle material texture, sharp readable silhouette and finish. Subject: ONE empty hooded cloak as a tangible wearable item, shown in a slight three-quarter product view, compact and centered on a square canvas. Hood visibly hollow with deep dark interior, shoulders draping into a broad cloth cape, a small tasteful aged-brass fastening clasp at the neck, layered irregular hem and convincing heavy flowing cloth folds. No person, face, body, mannequin, display stand or hanger. Main material: charcoal/slate blue woven cloth with cool silver-cyan iridescent edge highlights, warm rim light on upper folds; the lower hem has a restrained see-through shimmer suggesting invisibility while the bulk remains readable physical fabric with real thickness and shadow. Mature illustrated game item, not a wizard costume photo, not a triangular line icon or flat geometric SVG, not an emoji or minimal logo. Emphasize painted material and shaded folds with a similar level of detail to the vest reference. Entire cloak including hood and hem inside the frame, 75-80 percent canvas occupancy, generous transparent margins. Genuinely transparent RGBA background, no floor, no environmental shadows, no backdrop, card, badge, star symbol, text, lettering, price, sparkles or extra objects. Output square 1024x1024.
