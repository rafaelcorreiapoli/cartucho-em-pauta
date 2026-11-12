# BRSpire

Roguelike de cartas independente, jogável no navegador. Escolha Lula, Che ou Stalin. O primeiro estado e as conexões são sorteados a cada partida. O mapa reúne os 26 estados e o Distrito Federal. Conquiste os 26 estados em batalhas ou eventos para liberar o chefe em Brasília. O mapa oferece dois destinos enquanto restarem pelo menos dois estados.

```sh
bun install
bun run dev
```

Abra http://127.0.0.1:5174. Clique nas cartas ou use as teclas de 1 a 9. Para um ataque individual com mais de um rival, selecione o alvo depois de escolher a carta. Esc cancela a mira.

`bun test` verifica a simulação. `bun run build` gera o site estático em `dist/`.

Os retratos selecionados e os sprites dos rivais foram extraídos dos atlas do BR Wars e ficam em `public/assets`, junto com a arena e os 16 quadros gerados do Lula. O projeto roda com os próprios arquivos e dependências.

[Guia de arte das cartas](docs/arte-das-cartas.md)
