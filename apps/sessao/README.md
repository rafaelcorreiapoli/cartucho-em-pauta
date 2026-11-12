# Presidente da Sessão

Protótipo de movimentação multiplayer para até seis pessoas em um mapa do Congresso. O cliente usa Phaser. Bun e Colyseus mantêm as salas e decidem o movimento e as colisões.

```sh
bun install --frozen-lockfile
bun run server
```

Em outro terminal, execute `bun run dev` e abra http://localhost:5175. Crie uma sala e copie o link para uma segunda aba ou informe o código manualmente. Use WASD, as setas ou toque no chão pra andar. Para testar na rede local, abra o endereço de rede mostrado pelo Vite nos dois dispositivos e permita acesso às portas 5175 e 2568. Para um servidor em outro endereço, configure `VITE_GAME_SERVER` no cliente.

`bun run check` verifica os tipos, testa dois clientes contra um servidor Bun e gera o build web.

O mapa usa [Office Space Tileset](https://lpc.opengameart.org/content/office-space-tileset), CC0. Os avatares combinam caricaturas geradas com ImageGen e a animação de [Human RPG Character](https://opengameart.org/content/human-rpg-character), CC0.
