# Arquitetura de Presidente da Sessão

O Vite carrega `src/main.ts`, que cria o jogo Phaser, os painéis HTML e a conexão Colyseus. `server/index.ts` registra a sala no servidor Bun. O lobby e o HUD usam estilos de `packages/hud`. Estado de partida vive na sala em memória. O navegador guarda preferências locais, como nick e volume.

## Quem controla cada estado

| Estado | Responsabilidade |
| --- | --- |
| Posição, rota, sequência de inputs, presença e reconexão | `SessionRoom` mantém os jogadores. `movement.ts` aplica os inputs com as colisões de `map.ts` e as rotas de `navigation.ts`. |
| Fase, prazo, votos, orçamento, estabilidade e papéis | `PlenaryMatch` controla as transições no relógio do servidor. |
| Candidaturas, apuração, cargos e salários | `ElectionCycle` controla o mandato e pede ao jogo os débitos e créditos. |
| Dinheiro pessoal, popularidade e provas políticas | `PoliticalEconomy` controla as contas, ofertas e publicação de registros. |
| Missões ativas, concluídas, contadores e prêmios | `PersonalAgenda` pertence a cada conta. Lê saldo e popularidade da economia e devolve o prêmio na liquidação. |
| Custódia de itens e documentos, instalações e pedidos de transferência | `Gameplay` guarda o local de cada item, revalida o alcance e muda a custódia uma vez. Dinheiro gerado pelo mapa e largado por jogadores usa a mesma representação. |
| Fotos, cópias, apresentações e publicação | `PhotoAlbum` controla o acesso e usa `InformationRequests` para os pedidos. A cena da foto é capturada a partir da percepção do servidor. |
| NPCs, diálogo e compras | `npcs.ts` define o vendedor estático. `NpcDialogues` mantém sessões privadas e valida escolhas e tokens de compra. `Gameplay` valida a compra e usa a economia e a custódia já existentes. |
| Equipamentos e combate | `Gameplay` mantém a custódia de inventário e equipamento no mesmo registro. `VoiceEquipment` controla bateria e recarga. `Combat` controla dano, proteção, nocaute e recuperação. `character-stats.ts` define os atributos base e `SessionRoom` aplica a velocidade no início da partida. |
| Transporte e atendimento | `Transport` controla um vínculo exclusivo e projeta os estados visíveis. O passageiro segue a posição autoritativa do carregador e o vínculo termina antes da transição para o Plenário. `medical.ts` define alcance, velocidade e atendimento. `Gameplay` valida o local e o débito, e `Combat` aplica a recuperação. |
| Chamadas e Snake | `PhoneSession` controla convites, conexões e tabuleiros. `snake.ts` contém as regras do tabuleiro. A sala controla sinalização, presença e alcance de voz. `voice.ts` opera o WebRTC no cliente. |
| Câmera, sprites e HUD | `game.ts` renderiza o mapa e usa `network-movement.ts` para predição e reconciliação. Os painéis traduzem ações em comandos e desenham o estado recebido. `phone-photos.ts` controla a seleção no álbum e a prévia da câmera. |

## Comandos, eventos e privacidade

A sala lê mensagens como dados desconhecidos, valida a forma e verifica a fase. O domínio confirma posse, alcance, consentimento ou elegibilidade antes de mudar o estado. A predição de movimento no cliente reaplica somente os inputs ainda sem confirmação do servidor. Prazos, apuração e recompensas usam o relógio da sala. Ataque, socorro, transporte e tratamento têm identificadores crescentes por participante para descartar reenvios.

`publishGameplay` emite fatos internos depois da ação. O fluxo atual passa por `SessionRoom` e `PlenaryMatch` até a economia e a agenda. A sala também envia o aviso de obtenção ao jogador que recebeu o item. O cliente recebe projeções feitas para cada destinatário, incluindo a visão local do mapa, sua agenda, seu papel e as fotos a que tem acesso. O canal de voz tem alcance próprio e pode atravessar uma parede sem revelar o jogador no mapa.

Chamadas e Snake encerram ao sair da articulação ou ao perder a conexão. Uma queda durante a partida reserva o lugar por 30 segundos. A saída definitiva descarta os pedidos pendentes e larga os itens carregados. No encerramento da partida, a sala limpa os objetos e volta a aceitar entradas.

## Onde estender

- **Item ou interação.** Declare o item em `src/gameplay.ts` e a intenção no contrato correspondente. Implemente a validação no domínio que possui o estado e o controle visual no painel. Para itens, reaproveite as operações de custódia de `Gameplay`.
- **Missão.** Defina o rótulo e o prêmio em `src/politics.ts`. Use `PersonalAgenda` para o progresso e o baralho, ou `photo-missions.ts` para fatos observáveis em fotos. Reaproveite eventos existentes quando registrarem o fato necessário.
- **Evento.** Declare o fato em `GameplayEvent` e publique após a mutação bem-sucedida. Derive qualquer resposta ao cliente na projeção do destinatário.
- **Política.** Coloque regras de fase e voto em `PlenaryMatch`, regras de candidatura ou cargo em `ElectionCycle` e débitos, créditos e provas em `PoliticalEconomy`.
- **NPC.** Adicione a entidade estática e os nós de diálogo em `npcs.ts`. O HUD oferece a interação próxima, e `NpcDialogues` revalida alcance, sessão e condições das escolhas.

`bun run --cwd apps/sessao check` roda TypeScript, Bun Test e o build do Vite. Os testes da sala usam clientes Colyseus reais contra um processo Bun local. Os testes de domínio controlam tempo, aleatoriedade e posição para verificar transições e reenvios.

## Extensões de combate

`weapons.ts` define o sprite, o ponto de empunhadura, o arco, o alcance, o dano e a recarga de cada arma. Associe o item à arma em `equipment.ts`. `Combat` valida o golpe e publica a direção e o momento. `game.ts` compõe o sprite da arma sobre a pose direcional do personagem. A mesma composição serve para outros equipamentos de ataque.

## Auditoria e prioridades

| Severidade | Achado | Estado |
| --- | --- | --- |
| Crítica | Um comando de instalação podia resolver chaves herdadas, como `constructor`, e lançar uma exceção ao consultar coordenadas. | Corrigido com validação de chave própria e teste na conexão Colyseus. |
| Crítica | A atenuação de voz ocorria apenas no navegador receptor. | O servidor autoriza cada direção do áudio. O navegador transmissor fornece voz apenas aos destinatários autorizados e suspende o envio se a autorização expirar. |
| Alta | Um encerramento vindo de um comando político podia escapar da limpeza executada na transição do relógio ou na saída de um jogador. | Corrigido com uma única rotina de limpeza que pode ser chamada após qualquer transição. |
| Alta | Inventário controlava chamadas e Snake, enquanto a economia também controlava o baralho e a progressão de missões. | Resolvido com `PhoneSession` e `PersonalAgenda`. |
| Alta | Transferências livres admitem pedidos legítimos idênticos. Um reenvio explícito do mesmo comando também produz outro pagamento até o limite da rodada. | Aberto. Identificar a intenção original requer identidade de comando no protocolo. Custódia de itens, aceitação de pedidos e publicação têm guardas de estado próprias. |
| Média | O painel de objetos acumulava a seleção do álbum e a prévia de câmera. O fluxo de objetos e documentos ainda concentra muitas ações em `Gameplay.act`. | Câmera e álbum extraídos. O próximo recorte de servidor com fronteira própria é a tramitação de documentos. |
| Média | A forma de um comando ainda admite campos opcionais que variam por ação. Várias recusas de política são silenciosas. | A leitura agora obtém o identificador tipado e as ações do telefone têm uma fronteira própria. Contratos completos por intenção e feedback de política continuam pendentes. |
| Média | A integração cobre clientes reais, mas não simula perda de rede seguida de reconexão nem transporta microfone entre navegadores. | Aberto. A sincronização de inputs, sinalização, alcance e privacidade das projeções têm testes existentes ou ampliados. |
| Baixa | As compras eleitorais acumulavam uma lista de despesas sem consumidores. | Removida. A compra usa o débito comum, e o ciclo continua registrando os valores que usa na apuração. |
