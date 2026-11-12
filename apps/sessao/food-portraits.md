# Retratos de comida

Os retratos usam a xícara do jogo como referência. O ImageGen gera uma folha com 3 colunas e 2 linhas, resolução 1536 × 1024, fundo transparente e um objeto por célula. O prompt pede vista em três quartos, contorno escuro, luz quente, silhueta legível e margem transparente. Duas folhas acomodam a leva de dez alimentos.

- Primeira folha, em ordem de leitura — Pizza, Caixa de Bombom, Leite condensado, Prato de R$ 1, Coxinha e Café.
- Segunda folha, em ordem de leitura — Energético, Pão com mortadela, Lagosta e Picanha.

Para cada retrato, recorte a célula de 512 × 512 e exporte para WebP de 192 × 192 com alpha. Por exemplo, o recorte do primeiro item usa `cwebp -lossless -exact -crop 0 0 512 512 -resize 192 192 folha.png -o retrato-pizza.webp`. Confira o recorte em tamanho de inventário. Os nomes dos arquivos estão em `src/food.ts` e os WebPs ficam em `public/assets/`.
