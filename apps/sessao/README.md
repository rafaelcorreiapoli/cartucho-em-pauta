# Presidente da Sessão

Protótipo de movimentação multiplayer para até seis pessoas em um mapa do Congresso. O cliente usa Phaser. Bun e Colyseus mantêm as salas e decidem o movimento e as colisões.

```sh
bun install --frozen-lockfile
bun run server
```

Em outro terminal, execute `bun run dev` e abra http://localhost:5175. Crie uma sala e copie o link para uma segunda aba ou informe o código manualmente. Use WASD ou as setas para andar, ou clique no chão para o servidor calcular um caminho pelas portas e ao redor dos móveis com EasyStar. Para testar na rede local, abra o endereço de rede mostrado pelo Vite nos dois dispositivos e permita acesso às portas 5175 e 2568. Para um servidor em outro endereço, configure `VITE_GAME_SERVER` no cliente.

`bun run check` verifica os tipos, testa dois clientes contra um servidor Bun e gera o build web.

Os móveis e as caricaturas foram gerados com ImageGen. As caricaturas foram feitas de frente, perfil e costas, com duas poses de passada para cada direção, e empacotadas em quadros de 128×128. O perfil é espelhado no jogo para a quarta direção. O mapa usa um atlas de móveis próprio, pisos e paredes montados no Phaser.


## Voz da sala

Depois de entrar numa sala, clique em **Ativar voz** e permita o microfone. Todos que ativarem a voz na mesma sala podem conversar. Use **Silenciar microfone** para continuar ouvindo ou **Sair da voz** para desligar o microfone e o áudio da sala. A lista de falantes e o nome verde no mapa reagem ao áudio.

Para testar em duas abas no mesmo computador, use localhost e fones de ouvido. Para amigos em outros dispositivos, sirva o cliente por HTTPS e configure `VITE_GAME_SERVER` com o endereço seguro do servidor. A voz usa WebRTC e STUN por padrão. Se a rede bloquear a ligação direta, configure `VITE_VOICE_ICE_SERVERS` com a lista JSON de servidores ICE do seu provedor TURN. Variáveis `VITE_*` são visíveis ao cliente. Use credenciais de teste com validade curta.

## Publicar a POC

No diretório `apps/sessao`, publique o servidor e gere o cliente com o endpoint HTTPS do Fly:

```sh
flyctl deploy --remote-only --ha=false
VITE_GAME_SERVER=https://cartuchao-sessao-poc.fly.dev bun run build
netlify deploy --no-build --site f816c8e6-7051-4355-a0f6-466b3613863e --dir dist --alias presidente-sessao-poc
```

O deploy do Netlify é uma prévia. O Fly usa uma única máquina porque as salas ficam em memória e liga a máquina sob demanda.

## Teste local de filtro de voz

No Mac com Apple Silicon, o laboratório usa [rvc-mlx-realtime](https://github.com/tizee/rvc-mlx-realtime) e FFmpeg. Aponte `RVC_LAB_DIR` para uma pasta com o conversor em `rvc-mlx-realtime/`, seu ambiente em `rvc-mlx-realtime/.venv/` e os arquivos `.pth` e `.index` originais em `models/`. Os modelos comunitários vêm das páginas [Lula](https://huggingface.co/LH6582/Lula) e [Bolsonaro](https://huggingface.co/LH6582/Bolsonaro) do usuário LH6582 no Hugging Face.

Para habilitar as versões alternativas, extraia os modelos de [LulaModelo2](https://huggingface.co/gachan/LulaRVC/blob/main/LulaModelo2.zip) e [BolsonaroNovo](https://huggingface.co/JinglesDados/BolsonaroNovo/blob/main/BolsonaroNovo.zip) em `models/`. Renomeie os pares para `Lula-alternativo.pth` e `Lula-alternativo.index`, e `Bolsonaro-alternativo.pth` e `Bolsonaro-alternativo.index`.

```sh
RVC_LAB_DIR=/caminho/do/laboratorio bun run dev --host 127.0.0.1
```

Abra **Testar filtro de voz**. Grave até dez segundos, pare a gravação e ouça o resultado. Para comparar, escolha outra voz ou alterne entre **Mais suave** e **Anterior**, depois use **Aplicar à gravação**. O ajuste mais suave reduz ruído, diminui a influência do índice do modelo e preserva mais das consoantes e da dinâmica da gravação. O laboratório roda no servidor de desenvolvimento local. Os arquivos temporários são apagados após a conversão e a gravação não entra na chamada da sala.
