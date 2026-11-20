# Sprites do Collant da Invisibilidade

As oito folhas usam o mesmo homem genérico caricato, sem rosto, cabelo ou identidade do elenco. Cabeça grande, membros curtos, contorno fino prata/ciano e interior vazado. Objetos manipulados continuam opacos. Gerados com ImageGen usando a caminhada original e as poses equivalentes do elenco como referências.

| Ação | Grade | Quadros |
|---|---|---|
| Caminhada (frente/direita/costas/esquerda) | 4×4 | 16 |
| Ataque, impacto e queda (cada folha) | 4×3 | 12 |
| Celular e arrombamento (cada folha) | 4×1 | 4 |
| Embolsar e roubar (cada folha) | 4×2 | 8 |

Total: 76 quadros. Parado, carregado e desmaiado reutilizam os quadros correspondentes, como o elenco normal. O efeito mantém a identidade anônima até o prazo original inclusive após nocaute; o nome continua oculto. Maleta e fumaça da corrida preservam seu comportamento.

Fontes lossless: `hires-world/masters/collant-*.webp`. Prompts de geração e correção de transparência: `hires-world/collant-prompts.json`. O manifesto registra dimensões nativas, hashes, referências de enquadramento e recortes. Células nativas variam de aproximadamente 314 a 627 pixels; 512 é a resolução de entrega normalizada, não detalhe nativo garantido em cada fonte.

Entregas: `public/assets/world-hd/collant-{ação}-{128,256,512}.webp`, com aliases base em `public/assets/collant-{ação}.webp`. O carregador adaptativo existente solicita alta resolução conforme a demanda, preservando tamanho, direção e posição. A caminhada anterior `capa-invisibilidade-walk.webp` fica preservada como referência.

Reconstruir a partir de `apps/sessao`:

```sh
uv run --with pillow --with numpy --with scipy python dev/hires-world/build.py collant-
```

Revisão visual: `/sprites.html`, grupo Transformações, Collant da Invisibilidade. Conferir todas as ações e direções em 128/256/512 sobre fundo de mapa. Os guias de direção de arte de personagens continuam sendo leitura obrigatória antes de regenerar.
