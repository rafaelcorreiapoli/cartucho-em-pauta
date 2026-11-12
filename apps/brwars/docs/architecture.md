# Arquitetura e manutenção

## Regras compartilhadas

`packages/simulation/src/index.ts` é a fachada pública usada pelo browser e pelo servidor. Não contém regras. Os módulos internos importam seus colaboradores diretamente, sem voltar à fachada. Um teste verifica ciclos de dependência e impede acoplamento com React, Phaser e Colyseus.

- `model.ts` define o estado e os comandos serializáveis.
- `content.ts`, `heroes.ts` e `research.ts` concentram o catálogo e suas regras.
- `buildings.ts`, `population.ts` e `recruitment.ts` respondem consultas de elegibilidade, capacidade e preços.
- `commands/` valida e aplica intenções do jogador; o roteador preserva a API `execute`.
- `engine/step.ts` coordena cada passo; produção, obras e combate têm módulos próprios. A ordem das etapas é parte do comportamento da simulação.
- Economia, popularidade, cura, progressão e auras continuam em módulos de domínio próprios.

A simulação permanece síncrona e independente de rede e renderização. Treino e servidor usam as mesmas funções. Novas regras devem ser testadas aqui antes de serem apresentadas no HUD.

## Browser

`Battlefield.tsx` é o adaptador React: recebe a sessão e callbacks, monta o renderer e encerra seus recursos. Não decide combate.

`battle/mount.ts` controla o ciclo de vida Phaser e o resize. `viewport.ts` calcula a resolução. `scene.ts` coordena cenário, câmera e atualização. `UnitRenderer.ts` mantém sprites, interpolação, seleção e animações das tropas. `effects.ts` concentra feedback de partículas e tweens; `assets.ts` registra os atlas. Os controles DOM que acompanham o mapa ficam em `MapBuildingOverlays.tsx`.

`SelectionHUD.tsx` compõe o layout. `hud/context.ts` resolve a seleção uma vez. Detalhes, portraits e ações de base, terreno e prédio são componentes distintos. Ações inimigas são bloqueadas antes de encaminhar a seleção aos painéis. Comandos continuam validados na simulação; o estado disabled do HUD não é uma proteção de autoridade.

As interfaces são concretas e pequenas. Não há contêiner de injeção de dependências, repositórios artificiais ou hierarquias para funções puras. O estado autoritativo continua sendo `GameState`; o renderer mantém somente estado visual.

## Verificação

`bun run check` executa formatação, TypeScript estrito (incluindo código sem uso), testes, build e integração real de dois clientes WebSocket contra Bun. Para evitar conflito com outro servidor local:

```sh
BRWARS_INTEGRATION_PORT=2591 bun run check
```

`main.tsx` carrega o CSS base antes de `App` e seus estilos locais. Essa ordem é intencional: não reordenar imports com efeitos colaterais sem conferir o HUD no browser.

`bun run format` aplica Prettier. Assets gerados, metadados de atlas e diretórios de build ficam fora da formatação. Os testes cobrem regras de jogo, contratos de rede, permissões do HUD, dados de tooltip, seleção de frames, crescimento visual dos heróis e supersampling Retina. Um teste de arquitetura protege as fronteiras da simulação.
