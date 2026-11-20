# Presidente da Sessão

Jogo de negociação e sabotagem para uma a doze pessoas em um mapa do Congresso. Ao iniciar com menos de seis pessoas, bots identificados completam as vagas e participam do mesmo sorteio de infiltrados. Os parlamentares NPC opcionais ocupam os assentos restantes no Plenário. O cliente usa Phaser. Bun e Colyseus mantêm as salas e decidem o movimento e as colisões.

```sh
bun install --frozen-lockfile
bun run server
```

Em outro terminal, execute `bun run dev` e abra http://localhost:5175. Crie uma sala e copie o link para uma segunda aba ou informe o código manualmente. Use WASD ou as setas para andar, ou clique no chão para o servidor calcular um caminho pelas portas e ao redor dos móveis com EasyStar. Para testar na rede local, abra o endereço de rede mostrado pelo Vite nos dois dispositivos e permita acesso às portas 5175 e 2568. Para um servidor em outro endereço, configure `VITE_GAME_SERVER` no cliente.

Para testar sabotagens, rode o servidor com `SESSAO_LOCAL_SOLO=1 bun run server` e clique em **Iniciar como infiltrado** no lobby. É possível provocar a pane com uma pessoa. Abra a mesma sala em duas abas antes de começar se quiser testar também o reparo simultâneo.

Para depurar quedas de desempenho, clique em **FPS** no topo do mapa ou aperte **F8**. O botão passa a mostrar o FPS medido pelo Phaser, atualizado a cada meio segundo. Clique ou aperte F8 novamente para ocultar o valor.

O lobby toca “Corredores de Brasília”. Cada partida sorteia uma trilha entre “Covert Affair” e “Spy Glass” e mantém a escolha entre as fases. As músicas especiais de votação, perigo no Calote e resultado continuam com prioridade. A trilha da partida retoma da posição em que parou após uma interrupção; a do Calote sempre começa do início. As transições fazem fade out e depois fade in de 0,7 segundo cada, inclusive entre lobby e partida.

`bun run check` verifica os tipos, testa clientes contra um servidor Bun e gera o build web. Consulte a [arquitetura](ARCHITECTURE.md) para localizar regras, estado e pontos de extensão.

Os móveis e as caricaturas foram gerados com ImageGen. As caricaturas foram feitas de frente, perfil e costas, com duas poses de passada para cada direção, e empacotadas em quadros de 128×128. O perfil é espelhado no jogo para a quarta direção. O mapa usa um atlas de móveis próprio, pisos e paredes montados no Phaser.


## Editar a planta no Tiled

Abra [congresso.json](src/congresso.json) com **File → Open** no [Tiled](https://www.mapeditor.org/). O jogo lê esse arquivo diretamente. Salve com **File → Save**, aguarde o servidor de desenvolvimento reiniciar e recrie a sala para carregar a planta nova.

- **Salas**, **Pisos e corredores** e **Detalhes do piso** definem as áreas, cores, padrões de ladrilho e tapetes.
- **Paredes** contém retângulos inteiros. O jogo recorta as aberturas usando os retângulos de **Portas** e usa o resultado no desenho, na planta do Tab, na colisão e na linha de visão. Para mover uma porta, selecione o objeto nessa camada e mantenha-o alinhado dentro de uma parede, com a mesma espessura. As paredes aparecem inteiras no Tiled.
- **Mesas**, **Móveis** e **Pontos** posicionam os objetos e as referências usadas no jogo, como o terminal de segurança, os assentos e os cofres. Preserve os nomes dos pontos e das portas que o jogo usa para identificar esses objetos. Estações de serviço, câmeras e rotas de NPCs ainda têm coordenadas no código.

Para experimentar, selecione **Plenário 2** na camada **Portas**, troque **X** de `500` para `410` e salve. Em uma nova partida, a passagem fica centrada em `x=440` e o trecho em `x=530` vira parede. Use Tab para conferir a abertura na planta.

## Jogar uma sessão

O lobby mostra quem entrou e permite escolher uma caricatura antes de começar. O anfitrião pode desativar joguinhos de celular, votações de projetos, eleição para eliminação, câmera/fotos, vigilância, decoração e retratos/área VIP antes da partida. Sem projetos, Secretaria e Protocolo não aparecem, seus documentos e missões relacionadas ficam indisponíveis e o HUD oculta os controles de projetos. Sem eleição para eliminação, não há renovação automática de mandatos, pesquisa eleitoral, propaganda na Imprensa, discursos de campanha nem entrevistas eleitorais; as missões dessas ações também ficam indisponíveis. Cassações continuam disponíveis independentemente das duas opções.
O mapa ocupa toda a janela e a câmera acompanha o personagem entre as alas.
O lobby e os controles sobre o mapa usam os estilos de `packages/hud`.

Entre com um nick e crie a sala ou use o link de convite. A caricatura é
uma skin: o mapa, a voz e os avisos usam o nick. O anfitrião pode iniciar
sozinho ou convidar até onze amigos. O papel secreto é sorteado entre pessoas
e bots, independentemente da skin. No início da sessão, cada jogador recebe um
aviso privado com seu papel e objetivo. Os parlamentares ganham se chegarem ao
fim da sessão com pelo menos 45 de estabilidade ou se tirarem de jogo todos os
infiltrados. Os infiltrados ganham se o Congresso chegar ao fim da sessão abaixo
de 45 de estabilidade ou se a estabilidade cair a zero durante a partida. Cada ponto gasto além do orçamento custa dois de
estabilidade.

Consulte **Celular → Projetos** e fale com Enéas Carneiro no balcão da Secretaria
para solicitar um documento. Projetos dispensam carimbos e exigem duas
assinaturas. Você pode pedir assinaturas aos bots quando estiver perto deles.
O jogador com mandato que entregar
o documento a Ratinho no balcão do Protocolo entra como proponente. Protocolar é gratuito.

O Protocolo aceita um projeto por vez e já avisa todos quem o apresentou.
A articulação dura dois minutos. Se houver outra votação no Plenário, o projeto
aguarda sua conclusão. Após a apuração, o Protocolo reabre em um minuto. Cada
projeto pode ser votado uma vez por partida, e o proponente aparece na votação e
no histórico. Sem projeto protocolado, o relógio da sessão continua correndo.

No mapa, a visão de outros
jogadores é local e a voz perde volume com distância e paredes. Os pontos dourados
permitem auditar os valores e corrigir o painel após descobrir uma fraude. O
infiltrado pode mexer no painel uma vez por projeto para que o custo aparente de
aprovar seja menor.

A convocação aparece quando faltam 30 segundos. Ao abrir a votação, o servidor
reúne os jogadores nos doze pontos de chegada do Plenário, limpa as rotas anteriores
e fecha as três portas. Durante os 35 segundos de votação, os jogadores podem
andar, bater, nocautear, roubar, conversar por voz geral e negociar com quem estiver próximo. Todos na sala
ficam visíveis entre si e os corredores permanecem sob o fog of war.

A ala sul abriga o Plenário, com mesa diretora, tribuna,
assentos laterais e painel ligado ao projeto e cronômetro do HUD. A discussão e o
voto compartilham o mesmo temporizador. O servidor decide o confinamento para
movimento manual e por clique. Após a apuração, as portas e a voz por proximidade
voltam a funcionar e cada jogador permanece onde estava. O placar aparece em um
modal e também fica no histórico. Os bots podem falar por texto durante a votação, com base no que viram e nas provas que receberam. Use as ações do dossiê para compartilhar provas ou oferecer documentos a um bot próximo.

Uma queda de conexão reserva o lugar por 30 segundos. A reconexão automática
do Colyseus restaura o mesmo participante, seu voto e sua posição atual. A entrada
de novos participantes durante a partida segue o bloqueio existente da sala.
Um personagem nocauteado recupera parte dos PV antes da votação obrigatória.

Se a apuração eleitoral vencer durante a votação legislativa, ela aguarda a saída
do Plenário. Seu modal mostra os eleitos e as porcentagens calculadas a partir da
força apurada em cada disputa. Quando um eleito ocupa outro cargo por redistribuição
de vagas, o modal indica a disputa de origem dos votos.

## Dinheiro, popularidade e provas

Abra **Carteira e dossiê** durante a partida. Cada pessoa começa com R$ 80 mil
de dinheiro pessoal e recebe uma agenda privada, independente do papel e da
caricatura. Uma sala com pelo menos seis jogadores pode escolher dois infiltrados.

Perto de alguém, combine pela voz e transfira dinheiro, com registro público ou
de forma clandestina. O dinheiro muda de mãos na hora. O voto continua livre.
Cada jogador pode fazer até seis pagamentos por rodada. No Gabinete B, cada
participante pode aplicar uma verba pública uma vez na sessão, desviando ou não
uma parte dela. Aplicar mais dinheiro fortalece a estabilidade; desviar deixa
rastro. Um ponto do orçamento equivale a R$ 10 mil.

A Controladoria pode revelar um documento por rodada. Compartilhe uma prova
de graça, ofereça uma venda a alguém próximo ou divulgue o documento na
Imprensa. Divulgação de escândalos e campanhas afetam a popularidade.
Com 40 de popularidade, mandato ativo e três eleitores elegíveis na sessão,
fale com Chapolin Colorado no balcão da Corregedoria para convocar uma cassação.
Cada convocação custa R$ 100 mil da sua carteira. Após o aviso de 30 segundos,
o Plenário tem 35 segundos para votar. A maioria absoluta pode cassar um
suspeito. A pessoa cassada fica como assessora e perde voto, verba e sabotagem.
É possível convocar outra votação após a apuração, se ainda houver tempo.

## Mercado e equipamentos

No Apoio Técnico, aproxime-se do **João Appolinário** e use o atalho indicado para conversar. Abra o catálogo, compre um equipamento e selecione-o no inventário para equipar. O botão **Equipamentos** permite desequipar e controlar o modulador. O binóculo amplia a visão temporariamente com **B** e o colete reduz o dano. Com o porrete equipado, pressione **Espaço** ou clique no ícone equipado para atacar na direção em que o personagem está olhando. O golpe causa dano se encontrar outro jogador dentro do arco no momento do impacto. As barras acima dos personagens mostram a proporção de PV restante.

Os personagens têm PV, força e velocidade próprios. Um personagem sem PV fica temporariamente nocauteado. Ele recupera parte dos PV em oito segundos ou pode ser socorrido por alguém próximo. Durante a recuperação há proteção temporária contra novos golpes.

## Transporte e Enfermaria

Perto de um personagem nocauteado, use as ações contextuais para inspecionar, socorrer ou carregar. Durante o transporte, o carregador anda a 65% da velocidade normal e pode tirar fotos. Soltar, recuperar a consciência, desconectar ou entrar no Plenário encerra o transporte.

A Enfermaria fica ao norte do corredor principal, entre os Gabinetes 01 e 02. O Gabinete 05 tem entrada pela Central de Expediente. O Gabinete 06 fica no anexo leste. A maca oferece atendimento gratuito e restaura todos os PV. Ao chegar à maca carregando alguém nocauteado, o atendimento acorda e trata o paciente.

## Voz da sala

Depois de entrar numa sala, clique em **Ativar voz** e permita o microfone. Todos que ativarem a voz na mesma sala podem conversar. Para disfarçar a voz em partida, equipe o modulador comprado no mercado e ligue-o no painel de equipamentos. O navegador transforma o áudio enviado aos outros jogadores enquanto a bateria durar. Use **Silenciar microfone** para continuar ouvindo ou **Sair da voz** para desligar o microfone e o áudio da sala. A lista de falantes e o nome verde no mapa reagem ao áudio.

Para testar em duas abas no mesmo computador, use localhost e fones de ouvido. Para amigos em outros dispositivos, sirva o cliente por HTTPS e configure `VITE_GAME_SERVER` com o endereço seguro do servidor. A voz usa WebRTC e STUN por padrão. Se a rede bloquear a ligação direta, configure `VITE_VOICE_ICE_SERVERS` com a lista JSON de servidores ICE do seu provedor TURN. Variáveis `VITE_*` são visíveis ao cliente. Use credenciais de teste com validade curta.

## Publicar a POC

No diretório `apps/sessao`, publique o servidor e gere o cliente com o endpoint HTTPS do Fly:

```sh
flyctl deploy --remote-only --ha=false
VITE_GAME_SERVER=https://cartuchao-sessao-poc.fly.dev bun run build
netlify deploy --no-build --site f816c8e6-7051-4355-a0f6-466b3613863e --dir dist --alias presidente-sessao-poc
```

O deploy do Netlify é uma prévia. O Fly usa uma única máquina porque as salas ficam em memória e liga a máquina sob demanda.

## Teste dos modais legislativos no Chrome

Execute `SESSAO_LOCAL_SOLO=1 bun dev/legislative-modals-smoke-server.ts` e
`VITE_GAME_SERVER=http://127.0.0.1:26874 bun run dev --port 5194` em processos separados.
Abra o cliente no Playwright CLI com `dev/private-call-chrome.json` e execute
`run-code --filename=dev/legislative-modals-smoke.js`.

## Teste da loja no Chrome

Com `SESSAO_LOCAL_SOLO=1 bun dev/market-smoke-server.ts`, o jogador de teste começa no Apoio Técnico.
Sirva o cliente com `VITE_GAME_SERVER=http://127.0.0.1:2605 bun run dev --port 5212`.
Abra a página no Playwright CLI com `dev/private-call-chrome.json` e execute
`run-code --filename=dev/market-smoke.js`.

## Teste do HUD da votação no Chrome

Execute o servidor de teste com `PORT=2604 SESSAO_LOCAL_SOLO=1 bun dev/vote-history-smoke-server.ts`
e o cliente com `VITE_GAME_SERVER=http://127.0.0.1:2604 bun run dev --port 5211`.
Abra `http://127.0.0.1:5211/` no Playwright CLI com a configuração
`dev/private-call-chrome.json` e execute `run-code --filename=dev/vote-history-smoke.js`.
O servidor de teste simula protocolos em nome do jogador local. O teste confere o
proponente, os controles da cédula e o resumo da apuração.

## Teste da TV de campanha no Chrome

Execute o gameserver com `SESSAO_LOCAL_SOLO=1 bun dev/campaign-tv-smoke-server.ts`
e o cliente com `VITE_GAME_SERVER=http://127.0.0.1:2608 bun run dev --port 5218`.
Abra `http://127.0.0.1:5218/` no Playwright CLI com a configuração
`dev/private-call-chrome.json` e execute `run-code --filename=dev/campaign-tv-smoke.js`.
O teste compra duas propagandas pelas ações da Sala de Imprensa e verifica a
ordem, os lados da TV e o movimento reduzido em duas abas.

## Teste dos efeitos de recompensa no Chrome

Execute o gameserver com `SESSAO_LOCAL_SOLO=1 bun dev/reward-smoke-server.ts`
e o cliente com `VITE_GAME_SERVER=http://127.0.0.1:2607 bun run dev --port 5217`.
Abra `http://127.0.0.1:5217/` no Playwright CLI com a configuração
`dev/private-call-chrome.json` e execute `run-code --filename=dev/reward-smoke.js`.
O gameserver posiciona o jogador diante das estações. O teste clica nas ações reais
de cafezinho e verba, mede a animação e confirma a remoção dos efeitos.

## Especializações do personagem

Cada ponto é validado no servidor e aplica um benefício cumulativo nesta partida:

- **Arrombamento:** +25% da velocidade base para arrombar portas, armários e cofres.
- **Esconder dinheiro:** +25% da velocidade base para depositar dinheiro no próprio cofre.
- **Movimentação:** +50 de stamina máxima e +5% da velocidade base ao andar e correr.
- **Visão:** +10% do alcance base de visão; combina com binóculos e respeita paredes e panes elétricas.

Um ponto em velocidade de ação divide a duração por 1,25; dois pontos dividem por 1,50.
A distribuição usa um botão **+1** por especialização (atalhos **1–4**), com o efeito atual
e a prévia do próximo ponto na mesma linha. Não há confirmação adicional. Pedidos repetidos,
pontos inexistentes e pedidos de outra partida são rejeitados. Novas partidas zeram os benefícios.

## Teste dos atalhos de atributos no Chrome

Execute o gameserver com `SESSAO_LOCAL_SOLO=1 bun dev/attributes-smoke-server.ts`
e o cliente com `VITE_GAME_SERVER=http://127.0.0.1:2609 bun run dev --port 5219`.
Abra `http://127.0.0.1:5219/` no Playwright CLI com `dev/private-call-chrome.json`
e execute `run-code --filename=dev/attributes-smoke.js`.
O cenário concede dois pontos e antecipa a votação após o primeiro investimento
para verificar o bloqueio das teclas durante a contagem regressiva.

## Métricas do gameserver

O Fly coleta os contadores agregados em `/metrics`. No Grafana do Fly, use
`sum by (__name__) (increase({__name__=~"congresso_.+_total",app="cartuchao-sessao-poc"}[1h]))`
para acompanhar inícios, encerramentos, reconexões e divergências na última hora.
Para monitorar divergências de saldo, a expressão é
`sum(increase(congresso_economy_discrepancies_total{app="cartuchao-sessao-poc"}[15m])) > 0`.
O log `economy-discrepancy` identifica a sala para investigação. Os contadores
reiniciam com o processo e a coleta depende de a máquina estar ativa.

## Teste local de filtro de voz

No Mac com Apple Silicon, o laboratório usa [rvc-mlx-realtime](https://github.com/tizee/rvc-mlx-realtime) e FFmpeg. Aponte `RVC_LAB_DIR` para uma pasta com o conversor em `rvc-mlx-realtime/`, seu ambiente em `rvc-mlx-realtime/.venv/` e os arquivos `.pth` e `.index` originais em `models/`. Os modelos comunitários vêm das páginas [Lula](https://huggingface.co/LH6582/Lula) e [Bolsonaro](https://huggingface.co/LH6582/Bolsonaro) do usuário LH6582 no Hugging Face.

Para habilitar as versões alternativas, extraia os modelos de [LulaModelo2](https://huggingface.co/gachan/LulaRVC/blob/main/LulaModelo2.zip) e [BolsonaroNovo](https://huggingface.co/JinglesDados/BolsonaroNovo/blob/main/BolsonaroNovo.zip) em `models/`. Renomeie os pares para `Lula-alternativo.pth` e `Lula-alternativo.index`, e `Bolsonaro-alternativo.pth` e `Bolsonaro-alternativo.index`.

```sh
RVC_LAB_DIR=/caminho/do/laboratorio bun run dev --host 127.0.0.1
```

Abra **Testar filtro de voz**. Grave até dez segundos, pare a gravação e ouça o resultado. Para comparar, escolha outra voz ou alterne entre **Mais suave** e **Anterior**, depois use **Aplicar à gravação**. O ajuste mais suave reduz ruído, diminui a influência do índice do modelo e preserva mais das consoantes e da dinâmica da gravação. O laboratório roda no servidor de desenvolvimento local. Os arquivos temporários são apagados após a conversão e a gravação não entra na chamada da sala.

Para diagnosticar artefatos, compare **Voz original** com **Disfarce genérico** usando a mesma gravação. O disfarce usa o utilitário [Rubber Band](https://breakfastquay.com/rubberband/) para baixar o tom sem mudar a duração da fala. Instale com `brew install rubberband` no Mac.

## Eleições e cargos

Cada sessão começa com um sorteio de cargos: uma Presidência, uma vaga de
senador para cada três pessoas (preservando ao menos uma vaga de deputado),
e as demais vagas de deputado. Isso não depende de personagem, papel ou
agenda. A cada cinco minutos o jogo apura a eleição sem parar a exploração
ou a votação em curso. Mudanças de candidatura fecham 20 segundos antes.

O eleitorado é fictício. Popularidade, propaganda, tribuna, TV, apoios
públicos e escândalos divulgados compõem a força de cada candidato. Na Sala
de Imprensa, veicule propaganda por R$ 20 mil uma vez por ciclo para ganhar
+5 de força eleitoral até a renovação. Declare ou retire apoio na pesquisa
eleitoral durante a articulação. A pesquisa mostra uma estimativa com margem
limitada, e a tendência compara com a última amostra. No desempate vale
o sorteio fixado para a partida. Nenhuma promessa é obrigatória.

Apura-se a Presidência primeiro, depois o Senado. As vagas restantes vão aos
outros candidatos pela força eleitoral; quem não ganha o cargo disputado
continua no Congresso. O salário fictício do mandato anterior entra na
carteira na apuração: R$ 100 mil, R$ 60 mil ou R$ 40 mil, usando a unidade
de R$ 10 mil da economia do jogo. A campanha reinicia; carteira, provas,
agenda, popularidade e papel são preservados.

A Presidência pode contestar um projeto por mandato no Painel, exigindo
mais um voto a favor quando houver margem. Se perder o cargo, a contestação
perde efeito. Senadores podem encontrar dois documentos por rodada;
deputados têm acesso à verba do Gabinete B. Na Imprensa há propaganda e
publicação de provas; no Painel há discurso; na TV um jogador com voz
ativa pode transmitir para a sala por 15 segundos. Os limites de campanha
e entrevista valem por ciclo.

A visão é local durante a partida inteira: o mapa escurece fora do círculo
do personagem, e posições fora da visão não são enviadas ao cliente. O
bate-papo continua geral durante as votações, mesmo com a visão local.

No desenvolvimento, `bun run server` reinicia o servidor quando o código
muda. Como as salas ficam em memória, é preciso criar outra sala após
esse reinício.

## Objetos e celular

Na Central de Expediente, fale com **Silvio Santos** no **Balcão do Topa ou Não Topa**
para trocar as três missões ativas de uma vez. A troca é gratuita e pode ser feita
uma vez por partida. O progresso das missões trocadas é descartado e as recompensas
já recebidas ficam com o jogador. A copiadora continua funcionando na mesma sala.

No Cafezinho, na Secretaria e no Credenciamento, use **Objetos próximos**
para recolher café, formulários e presentes. Maletas, cuecas e maços podem
ser embolsados na hora ou carregados para entregar, guardar ou depositar
na Tesouraria. O Inventário comporta seis objetos. Quem receber uma oferta
ou pedido de assinatura pode inspecionar o objeto e aceitar ou recusar.
Pagamentos e ofertas de objetos são independentes.

Os formulários da Secretaria têm combinações diferentes de carimbos e
assinaturas. Inspecione o documento para ver o que falta, peça assinaturas
a jogadores próximos e visite os balcões indicados. O Protocolo mantém os
documentos aceitos no registro do balcão. O Arquivo e o Gabinete B têm compartimentos compartilhados,
acessíveis a quem estiver perto.

O **Celular** abre Telefone, Joguinhos, Câmera e Álbum. Ative o microfone para ligar para outra pessoa. Em Joguinhos, selecione **Snake** e colete cinco frutas com as setas, WASD ou os controles na tela. As fotos públicas ficam em **Álbum → Publicadas** e a pesquisa eleitoral na barra superior. Convite, volumes e saída da sala ficam na engrenagem.

O servidor emite eventos de interação com posição, horário e testemunhas
calculadas pela visibilidade do mapa. A agenda usa esses eventos para
missões de protocolo, entrega, fotografia e ações sem testemunhas.
Pedidos entre jogadores aparecem apenas para quem os recebeu. O jogo da
memória considera testemunhas durante toda a rodada.

### Câmera e objetos expostos

Abra um objeto no inventário e escolha **Expor acima do personagem**. Só um item fica exposto por vez. Largar, usar, guardar ou entregar o objeto encerra a exposição. O servidor envia o indicador junto ao jogador apenas a quem consegue vê-lo.

Em **Celular → Câmera**, use **Tirar foto** ou **Selfie**. A prévia acompanha o enquadramento. Ao disparar, o servidor congela a posição, a direção, os itens expostos, os objetos no chão e as instalações que entram no quadro e passam pela visibilidade. O cliente desenha o quadro com o mapa e os sprites Phaser, usando exclusivamente esse registro para a imagem salva. As miniaturas são geradas no cliente. Uma entrega recente só entra no quadro quando os dois participantes continuam visíveis perto de onde a entrega ocorreu.

O **Álbum** guarda até 12 imagens por jogador e a sala comporta até 144 originais. **Mostrar** concede uma visualização temporária após aceite. **Enviar cópia** adiciona uma referência ao mesmo original no álbum do destinatário. Ambas exigem proximidade no envio e no aceite. Excluir do álbum retira apenas a própria referência. Na Sala de Imprensa, **Publicar foto** torna a imagem pública. A negociação de preço usa a transferência de dinheiro existente e o envio da cópia é uma ação separada. A primeira selfie própria publicada com companhia rende +4 de popularidade na partida. Uma imagem registra o que aparece no quadro e não gera uma acusação automática.

O **Cafezinho** vende a pizza e tem uma mesa para servir seis fatias. Cada pessoa pode pegar uma fatia de cada pizza. O **Credenciamento** vende retratos e placas VIP. Os pontos de instalação aparecem como ações no item ao se aproximar de uma superfície válida. Retratos podem ser rabiscados, retirados e substituídos. Placas reservam simbolicamente uma cadeira ou espaço sem bloquear passagem. Fotos, instalações e fatias usam o mesmo sistema de eventos das agendas. As agendas fotográficas contabilizam fatos distintos e os caprichos liberam espaço sem prêmio em dinheiro.

### HUD da partida

A barra superior concentra carteira, popularidade, indicadores do Parlamento e eleição. O mapa usa a faixa central como viewport do Phaser, incluindo fog, coordenadas de clique e feedback espacial. A faixa inferior reúne perfil, agenda sob demanda, projeto e votação, itens de uso rápido, equipamentos e comunicação. O resultado legislativo aparece temporariamente no centro do painel e fica disponível no histórico.

Use as teclas numéricas indicadas para acionar o contexto atual, `Shift+1` a `Shift+6` para abrir um slot e `Esc` para fechar um painel. Os atalhos de local correspondem ao ponto de interação ao alcance. Os objetos disponíveis ficam em **Objetos próximos**.

### Smoke test de chamada privada no Chrome

Com `playwright-cli` disponível, inicie o gameserver com
`SESSAO_LOCAL_SOLO=1 PORT=2597 bun server/index.ts`. Em outro terminal,
execute `bunx vite --host 127.0.0.1 --port 5197 --strictPort`. No diretório
deste app, execute:

```sh
playwright-cli -s=sessao-call open --browser=chrome --config=dev/private-call-chrome.json http://127.0.0.1:5197/
playwright-cli -s=sessao-call run-code --filename=dev/private-call-smoke.js
playwright-cli -s=sessao-call close
```

O teste injeta um sinal sintético e mede o áudio recebido por WebRTC em dois
clientes da mesma sala. A saída de áudio é silenciada pelo teste, que também
substitui a captura de microfone antes de iniciar o VoIP.

### Smoke test do filtro de Megafone no Chrome

Com o Vite e a sessão Chrome silenciosa da seção anterior, execute a partir de
`apps/sessao`:

```sh
playwright-cli -s=sessao-call run-code --filename=dev/megaphone-speech-smoke.js
```

A gravação `dev/fixtures/megaphone-pt-br.flac` foi sintetizada no macOS com a
voz Luciana, a 155 palavras por minuto, e convertida para FLAC mono a 24 kHz.
O workflow também executa o teste em Chrome headless.

O teste conecta três clientes ao gameserver e mede o áudio recebido por WebRTC.
Compara a relação entre graves e médios com e sem Megafone e repete a
comparação com o Modulador ativo. Também verifica o isolamento da chamada
privada, o mute e uma única trilha de áudio por conexão.

Para salvar os clipes, abra o Vite com `?captureVoice=1` antes de executar o
teste. Cada gravação recebe a mesma fala completa, com um ciclo de recarga
entre os dois modos de Megafone. Os arquivos são gravados em
`/tmp/sessao-megaphone-*.webm`.

Os efeitos de passos usam quatro recortes de [Footsteps Carpet, de LewisEmmott5](https://freesound.org/people/LewisEmmott5/sounds/732573/) (CC0), com volume ajustado para a caminhada.

Com câmera/fotos desativadas, não há captura, álbum, compartilhamento, anexos fotográficos no Correio nem denúncias com foto na Corregedoria. Missões fotográficas saem do sorteio. A vigilância ao vivo continua disponível.

Sem vigilância, grampos, câmeras escondidas e Detector de Escutas saem da loja, as oito missões relacionadas saem do sorteio e o aplicativo e o terminal da Central de Segurança ficam indisponíveis. A câmera de fotos do celular continua independente dessa opção.

Decoração e retratos/área VIP são opções independentes. Sem decoração, TV, tapete e poltrona ficam indisponíveis, Roberto Justus não aparece e seis missões de móveis saem do sorteio. Sem retratos/área VIP, retratos e placas VIP ficam indisponíveis, Donald Trump não aparece e 12 missões relacionadas saem do sorteio. Comida, mesas de pizza e segurança dos gabinetes continuam independentes.

## Modos de jogo

O anfitrião seleciona o modo no lobby antes de iniciar ou jogar novamente. Os convidados veem a escolha, mas não podem alterá-la. O tutorial permanece no Clássico.

- **Clássico:** mantém as regras de estabilidade institucional.
- **Calote:** não usa estabilidade como recurso ou condição de vitória. O lobby permite escolher 30, 45 ou 60 segundos seguidos de orçamento negativo para dar vitória aos infiltrados (padrão: 30s). Voltar a zero ou a um saldo positivo cancela a contagem; uma nova dívida começa o tempo completo escolhido. Salários, orçamento, eleições, cassações e duração da sessão continuam funcionando, respeitando as opções selecionadas. Os parlamentares vencem ao eliminar todos os infiltrados ou sobreviver até o fim da sessão sem completar um calote. Se o tempo limite terminar exatamente no encerramento, o calote prevalece.

O cronômetro de calote acompanha o relógio da partida, que pausa durante votações. A barra do Calote tem zero no centro, saldo positivo verde à direita, dívida vermelha à esquerda e contagem regressiva no vermelho. A escala usa o orçamento inicial como limite de cada metade; saldos além da escala preenchem a metade inteira e continuam exibidos numericamente. Painéis de projetos e investimentos ocultam efeitos de estabilidade nesse modo, e a missão que exige estabilidade crítica não entra no sorteio.

O fluxo de navegador `dev/calote-smoke.js` valida seleção no lobby, a barra em dois tamanhos de tela, recuperação da dívida e derrota por calote.

### Projetos automáticos no Calote

A opção **Projetos automáticos** do lobby aprova quatro projetos, em ordem sorteada sem repetição, aos 5:00, 6:30, 8:00 e 9:30 de tempo efetivo. O relógio pausa nas votações. O próximo projeto permanece secreto até a aprovação. O HUD mostra countdown, histórico e um anúncio central por dez segundos, que também pode ser fechado manualmente. Não há votação ou veto, e o gasto é aplicado mesmo sem saldo.

Custos por jogador com mandato na aprovação: Porrete R$ 10 mil (um porrete), Reajuste R$ 5 mil (+25% nos próximos salários até o fim), Congresso Sem Dormir R$ 10 mil (cinco energéticos) e Qualificação R$ 15 mil (dois pontos de atributo). Infiltrados também recebem os efeitos; jogadores eliminados não recebem. A folha salarial existente inclui os NPCs e também recebe o reajuste. Itens ocupam o inventário, aproveitando pilhas existentes; excedentes vão ao armário pessoal e depois ao chão do próprio gabinete.

Novas salas começam em Calote, com dois infiltrados, três NPCs, projetos automáticos, fotos e eleições ligados. As outras opções começam desligadas. O tutorial preserva suas mecânicas de treinamento. A votação opcional de projetos permanece independente.

O smoke `dev/automatic-projects-smoke.js` verifica o padrão do lobby, sigilo, quatro aprovações, imagens, anúncio em 800×450 e histórico. As imagens e seus prompts estão documentados em `docs/automatic-project-images.json` na raiz do repositório.

A trilha de orçamento negativo no Calote é “Hitman”, de Kevin MacLeod (incompetech.com), sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), sem alterações e na velocidade original durante toda a contagem. Créditos disponíveis na entrada do jogo e em `public/assets/audio/CREDITS.md`.
