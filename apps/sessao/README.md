# Presidente da Sessão

Jogo de negociação e sabotagem para três a seis pessoas em um mapa do Congresso. O cliente usa Phaser. Bun e Colyseus mantêm as salas e decidem o movimento e as colisões.

```sh
bun install --frozen-lockfile
bun run server
```

Em outro terminal, execute `bun run dev` e abra http://localhost:5175. Crie uma sala e copie o link para uma segunda aba ou informe o código manualmente. Use WASD ou as setas para andar, ou clique no chão para o servidor calcular um caminho pelas portas e ao redor dos móveis com EasyStar. Para testar na rede local, abra o endereço de rede mostrado pelo Vite nos dois dispositivos e permita acesso às portas 5175 e 2568. Para um servidor em outro endereço, configure `VITE_GAME_SERVER` no cliente.

`bun run check` verifica os tipos, testa três clientes contra um servidor Bun e gera o build web.

Os móveis e as caricaturas foram gerados com ImageGen. As caricaturas foram feitas de frente, perfil e costas, com duas poses de passada para cada direção, e empacotadas em quadros de 128×128. O perfil é espelhado no jogo para a quarta direção. O mapa usa um atlas de móveis próprio, pisos e paredes montados no Phaser.


## Jogar uma sessão

O lobby mostra quem entrou e permite escolher uma caricatura antes de começar.
O mapa ocupa toda a janela e a câmera acompanha o personagem entre as alas.
O lobby e os controles sobre o mapa usam os estilos de `packages/hud`.

Crie uma sala, copie o link e reúna de 3 a 6 pessoas. Ativem a voz e iniciem a
sessão. Um infiltrado é sorteado independentemente do personagem. Os
parlamentares ganham se terminarem os três projetos com pelo menos 45 de
estabilidade; o infiltrado ganha se impedir isso. Se chegar a zero, a partida
termina na hora. Cada ponto gasto além do orçamento custa dois de estabilidade.

Cada projeto começa com 3 minutos e 25 segundos de articulação. No mapa, a visão de outros
jogadores é local e a voz perde volume com distância e paredes. Os pontos dourados
permitem protocolar uma emenda que troca estabilidade por economia, auditar os
valores e corrigir o painel após descobrir uma fraude. O infiltrado pode mexer no
painel uma vez por projeto para que o custo aparente de aprovar seja menor.

Na votação, todos voltam a se ouvir e têm 35 segundos para aprovar ou rejeitar.
O projeto precisa de mais da metade dos jogadores a favor. O resultado usa os
valores reais, mesmo se a fraude não for descoberta. No fim, a sala mostra quem
era o infiltrado e permite jogar de novo.

## Dinheiro, popularidade e provas

Abra **Carteira e dossiê** durante a partida. Cada pessoa começa com R$ 80 mil
de dinheiro pessoal e recebe uma agenda privada, independente do papel e da
caricatura. Uma sala cheia pode jogar com um ou dois infiltrados.

Perto de alguém, combine pela voz e transfira dinheiro, com registro público ou
de forma clandestina. O dinheiro muda de mãos na hora. O voto continua livre.
Cada jogador pode fazer até seis pagamentos por rodada. No Gabinete B, cada
participante pode aplicar uma verba pública uma vez na sessão, desviando ou não
uma parte dela. Aplicar mais dinheiro fortalece a estabilidade; desviar deixa
rastro. Um ponto do orçamento equivale a R$ 10 mil.

A Controladoria pode revelar um documento por rodada. Compartilhe uma prova
de graça, ofereça uma venda a alguém próximo ou divulgue o documento na
Imprensa. Divulgação de escândalos e campanhas afetam a popularidade.
Com 55 de popularidade, um parlamentar com mandato pode convocar, no Painel,
a única votação de cassação da sessão. A voz é geral durante a reunião.
Cassar um parlamentar custa 12 de estabilidade. A pessoa cassada fica como
assessora: conversa, negocia e investiga, mas perde voto, verba e sabotagem.

## Voz da sala

Depois de entrar numa sala, clique em **Ativar voz** e permita o microfone. Todos que ativarem a voz na mesma sala podem conversar. Para experimentar o efeito ao vivo, marque **Ativar disfarce** e ajuste o tom e o timbre. O navegador transforma o áudio enviado aos outros jogadores. Use **Silenciar microfone** para continuar ouvindo ou **Sair da voz** para desligar o microfone e o áudio da sala. A lista de falantes e o nome verde no mapa reagem ao áudio.

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

Para diagnosticar artefatos, compare **Voz original** com **Disfarce genérico** usando a mesma gravação. O disfarce usa o utilitário [Rubber Band](https://breakfastquay.com/rubberband/) para baixar o tom sem mudar a duração da fala. Instale com `brew install rubberband` no Mac.
