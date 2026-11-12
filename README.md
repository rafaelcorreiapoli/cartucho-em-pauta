# Cartucho em Pauta

Portal e jogos de sátira política brasileira, com builds e deploys independentes.

| Projeto | Diretório | Instalação | Validação |
| --- | --- | --- | --- |
| Cartucho | `apps/cartucho` | `npm ci` | `npm run check` |
| BR Wars, incluindo o servidor | `apps/brwars` | `bun install --frozen-lockfile` | `bun run check` |
| BRSpire | `apps/brspire` | `bun install --frozen-lockfile` | `bun run check` |

Execute os comandos no diretório do app, com Node.js 24 para o Cartucho e Bun 1.4.4 para os jogos. O BR Wars mantém seu workspace interno para o cliente web, o servidor e a simulação. Cada app mantém seu lockfile.

O catálogo em `packages/personagens/characters.json` relaciona um ID por personagem às artes que cada app usa. Os builds copiam essas variantes para os caminhos que os jogos já esperam. As animações e regras específicas continuam nos jogos. Para adicionar um asset compartilhado, coloque o arquivo em `packages/personagens/assets/<app>` e registre seu nome no catálogo. Para BR Wars e BRSpire, inclua o destino gerado no `.gitignore` do app.

Para rodar localmente, use `bun run dev` em cada jogo. Para o Cartucho, rode `npm run build` e `npx netlify-cli@26.1.0 dev --offline --dir dist` em `apps/cartucho` para incluir a função do ranking. As páginas de jogo do Cartucho apontam para os clientes publicados.

## Pipelines

Cada workflow valida seu app em PRs e em pushes para `main` que alterem o app, o pacote de personagens ou o workflow. O BR Wars também testa a integração multiplayer e constrói a imagem do servidor.

Para publicar a partir de `main`, execute o workflow do projeto manualmente com `publish_web` e, no BR Wars, `publish_server` quando aplicável. Configure `NETLIFY_AUTH_TOKEN` para os frontends e `FLY_API_TOKEN` para o servidor. Os workflows apontam para os sites Netlify existentes e para o app Fly definido em `apps/brwars/fly.toml`.

A importação parte dos commits `816ed40` do Cartucho, `49ccaad` do BR Wars e `47ba970` do BRSpire.
