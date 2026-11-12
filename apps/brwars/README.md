# BASE ALIADA — V1

RTS de browser: duas civilizações inspiradas na esquerda e na direita brasileiras em guerra. Você controla construções, produção e economia; tropas e heróis lutam automaticamente. Não é uma simulação eleitoral.

## Executar

Requer Bun 1.4.4 ou superior.

```sh
bun install
bun run dev
```

Abra http://localhost:5173. O servidor Colyseus/Bun fica em http://localhost:2567. A página começa em treino contra IA; **Menu** permite escolher a civilização ou criar/entrar numa sala 1v1.

Para jogar pela rede local, abra o endereço de rede que o Vite imprime. Os dois browsers precisam alcançar as portas 5173 e 2567 do mesmo computador. Em produção, defina `VITE_GAME_SERVER=wss://seu-servidor` antes do build e use HTTPS/WSS. Não há deploy configurado nesta V1.

## Mecânicas

- Uma lane, 16 terrenos por lado e base com 5.000 de vida.
- Um prédio inicial; infantaria, ataques à distância e cerco com produção automática.
- Construções e melhorias até nível 15. Cada nível aumenta vida e dano das próximas tropas em 5%.
- Trabalhadores territoriais: R$ 120 por contratação, renda de R$ 3/s cada, população compartilhada com o exército, ampliável por moradias até 200. Renda passiva adicional de R$ 8/s.
- Banco: três ofertas de crédito e três aplicações, até seis contratos ativos de cada tipo; parcelas e vencimentos independentes.
- Impostos de 0% a 30% alteram arrecadação e estabilidade. Popularidade negativa gera crise gradual.
- Heróis: oito personagens entre as duas facções, recrutamento manual, até três diferentes por jogador incluindo a fila, cinco passivas de área por personagem, desbloqueadas nos níveis 1/3/5/7/10. Custo comum R$ 480 (primeiro grátis), treinamento-base 12s e recuperação no Hospital.
- Impactos melee de quadrinhos, partículas de sangue, projéteis e rastros feitos com Phaser; representação gráfica orientada por eventos do combate.
- Destruir a base vence. Não há limite de tempo nem desgaste automático das bases. Destruição simultânea resulta em empate; no online, abandono ou expiração da reconexão concede vitória ao adversário.
- Melhorias também estão disponíveis diretamente no mapa: botão ao lado da construção e indicador de 15 segmentos. Barras de vida usam verde (≥70%), amarelo (30–69%) e vermelho (<30%), com contorno de contraste.
- No online, abandono concede vitória ao adversário. Quedas de conexão reservam a vaga por 30s e permitem reconectar na mesma aba.

Os atributos das duas civilizações são equivalentes na V1; identidade e unidades são diferentes. As unidades usam folhas com quatro frames de caminhada, dois de ataque e dois de morte. Os ciclos e o balanceamento são preliminares.

## Controles

Clique nas áreas demarcadas no mapa para selecionar um terreno. O HUD inferior mostra apenas as informações e ações da seleção: terreno livre oferece construções; prédio mostra produção e melhoria; unidade mostra vida, dano, alcance e comportamento automático; base oferece trabalhadores e herói; Banco oferece empréstimos e aplicações. Não há seletores de terrenos no HUD. Os atalhos são letras destacadas em amarelo dentro dos nomes das ações visíveis; **V** volta às categorias. Magias globais usam **1, 2, 3 e 4**. **Esc** ou um clique no chão limpa a seleção. Objetos inimigos podem ser inspecionados, sem receber comandos. O layout principal é para desktop; telas estreitas recebem uma versão compacta do HUD.

## Organização

- `apps/web`: Phaser 4 + React + Vite; HUD e representação da partida em alta densidade de pixels.
- `apps/server`: Bun + transporte WebSocket nativo do Colyseus; uma sala por partida, duas vagas, validação e limite de mensagens.
- `packages/simulation`: regras independentes de UI e rede, compartilhadas pelo treino e pelo servidor.
- `scripts/integration.ts`: teste real de dois clientes contra um servidor Bun isolado.

A simulação avança em passos fixos de 50ms; o estado online sincroniza a cada 100ms. Phaser interpola o movimento e reproduz efeitos visuais sem decidir dano. A sala identifica a civilização pela sessão, nunca por uma escolha no comando enviado pelo cliente.

As partidas online vivem em memória. Reiniciar o servidor perde as salas; não há contas, ranking, matchmaking público, banco de dados ou recuperação de partida após reinício nesta V1.

A divisão de responsabilidades e as regras para estender o código estão em [docs/architecture.md](docs/architecture.md).

## Editar cenários

Abra os arquivos JSON em `packages/simulation/src/maps` no Tiled. A camada `terrain` usa verde para células de construção, ocre para passagem das tropas e verde escuro para bloqueios. As camadas `plots-left` e `plots-right` marcam o centro de cada lote. Use o número do lote como nome do objeto e a propriedade booleana `owned` para os lotes iniciais. O quartel inicial ocupa o lote 0 de cada lado.

Mantenha a grade em 48 × 24 células de 50 unidades. A camada `route` contém um segmento reto de dois pontos e precisa cruzar células de passagem em toda a largura do corredor. `bases`, `road` e `decorations` posicionam as imagens do cenário. Salve em JSON com os dados da camada de tiles como array e mantenha o tileset da legenda junto aos mapas.

## Verificação

```sh
bun run check
```

Executa Prettier, TypeScript estrito, testes com Vitest, build do browser e integração multiplayer com servidor Bun na porta 2579 (configurável por `BRWARS_INTEGRATION_PORT`). O workflow do GitHub executa a mesma sequência quando houver um remoto configurado.

Arte gerada com a ferramenta de imagens integrada, fontes locais e ícones Phosphor. Detalhes em [docs/assets.md](docs/assets.md).

### Construção, popularidade e poder global

Novos prédios levam 10–20 segundos para construir, com animação e progresso no mapa. Produção e melhorias são liberadas ao terminar. Um terreno vazio abre o catálogo em toda a área do HUD ao lado do minimapa.

Feira cultural/Estádio gera até +0,6 de popularidade por segundo, mais 5% da taxa-base por nível, com retorno decrescente por tipo. Popularidade varia entre −200 e +200. **Chuva de boletos** (1) custa 60 de popularidade por uso após desbloquear, recarrega em 45 segundos e causa 40% da vida máxima de dano a todas as tropas inimigas. Bases e aliados ficam intactos.

O botão de áudio na barra superior controla música, efeitos e mute. Áudio começa após a primeira interação; a trilha e os efeitos originais usam assets CC0. A fonte do meme de entrada em campo do Lula está registrada em [docs/meme-audio-catalog.md](docs/meme-audio-catalog.md).

### Câmera RTS

O mundo tem 2400×1200, separado da janela visível. Mova a câmera com scroll de dois dedos no trackpad (horizontal e vertical, com inércia), pelas bordas do campo, segurando as setas ou arrastando com o botão do meio. Clique ou arraste no minimapa para navegar; o retângulo acompanha a região visível. **Home** ou **Espaço** retorna à base da sua facção. O HUD permanece fixo e os controles dos prédios acompanham suas posições no mundo. A câmera respeita os limites do mapa e para ao perder foco ou abrir um diálogo.

### Arsenal global e expansão

Cada civilização dispõe de **16 terrenos**, em duas fileiras acima e duas abaixo da região central. O cenário tem territórios gramados nas extremidades; a estrada conecta apenas as duas regiões.

Os quatro poderes aparecem no centro superior. Clique para invocar ou use **1, 2, 3 ou 4**. Cada magia tem sua própria recarga de 45s, sem bloquear as demais:

| Poder | Custo em popularidade | Efeito |
|---|---:|---|
| Chuva de boletos | 60 | Dano de 40% da vida máxima às tropas inimigas |
| Volta pro grupo! | 80 | Todas as tropas inimigas voltam à própria entrada |
| Modo avião | 70 | Inimigos presentes ficam 6s sem atacar |
| Agora vai! | 75 | Dano 2× por 10s para os aliados presentes |

Os efeitos temporários atingem as tropas existentes na invocação; novas tropas não os herdam. Não alteram vida ou velocidade. Anéis dourados indicam força aumentada; símbolo azul indica silêncio. Todos os efeitos, requisitos e recargas são validados no servidor.


### Trabalhadores e moradias

As bases ficam mais próximas do centro, reservando atrás de cada uma uma área livre para os trabalhadores. Cada trabalhador contratado aparece como um personagem com sombra e caminhada própria. Faz trajetos variados, faz pausas nessa região e pode ser selecionado para inspecionar sua renda de R$ 3/s. Essa movimentação é cosmética; não muda renda, combate ou o estado autoritativo.

**Ocupação coletiva** (esquerda) / **Apê Faria Lima** (direita): R$ 200, construção de 12s, atalho O (esquerda) / A (direita) no catálogo de terreno. Cada moradia pronta acrescenta 6 vagas à capacidade inicial de 12, mais 2 por nível adicional, até 200 vagas compartilhadas entre trabalhadores, tropas e reservas de produção. Obras não liberam vagas antecipadamente. Moradias não recrutam automaticamente nem geram popularidade; os trabalhadores continuam sendo contratados na base.


### Produção manual na base

Trabalhadores levam 5s e heróis 12s. Cada pedido entra na fila da base, com pagamento antecipado (exceto o primeiro herói grátis) (até 5 pedidos), processada um por vez. O HUD da base mostra fila e progresso; uma pequena barra no mapa acompanha o treinamento ativo. Trabalhadores só passam a gerar renda ao terminar. Somente o pedido ativo reserva população antes de começar. Pedidos sem vagas aguardam sem avançar; heróis na fila impedem pedidos duplicados.

### HUD de atividade

O HUD compacto usa atividade/progresso no centro, portrait da seleção entre os painéis e ações à direita. Durante a produção, o centro mostra o portrait da unidade sendo treinada, progresso e fila da base. Os cabeçalhos e rodapés internos foram removidos.


| Unidade | R$ adicional | Popularidade |
|---|---:|---:|
| Trabalhador | 60 | 10 |
| Linha de frente | 90 | 12 |
| Ataque à distância | 120 | 16 |
| Cerco | 160 | 20 |
| Herói | 180 | 30 |

O backdrop e os títulos de poderes globais ficam presos ao viewport, com tamanho corrigido pelo zoom/DPI, acompanhando movimento e redimensionamento da câmera.


### Banco e finanças sempre visíveis

O Banco custa R$ 220 e leva 12s para ficar pronto (Y no terreno). A base central só recruta trabalhadores e heróis. Seus botões mostram o portrait e o custo em uma faixa escura, com fonte maior.

A faixa econômica permanente mostra todos os contratos ativos, dívida, principal aplicado, parcelas, vencimentos e progresso. Quitar um empréstimo desconta os juros futuros; sacar uma aplicação antes do prazo devolve o principal e perde o rendimento. Cada categoria aceita até seis contratos simultâneos.

| Crédito | Recebe | Juros-base | Prazo | Total-base |
|---|---:|---:|---:|---:|
| Ponte | 200 | 12% | 30s | 224 |
| Capital de giro | 300 | 20% | 60s | 360 |
| Expansão | 600 | 30% | 90s | 780 |

| Aplicação | Investe | Prazo | Recebe |
|---|---:|---:|---:|
| Reserva | 150 | 30s | 154,50 |
| Renda fixa | 300 | 60s | 318 |
| Longo prazo | 600 | 90s | 660 |

Os prazos são tempo de jogo comprimido. Juros são definidos pelo Banco e fixados ao contratar. Exposição acima de 50%/80% do limite acrescenta 5/10 pontos percentuais somente aos novos empréstimos. Limite de crédito = renda normal × 40, aumentado em 10% por nível adicional do melhor Banco. Trocar impostos não aumenta artificialmente esse limite. Aplicar dinheiro emprestado custa mais em juros do que rende pelo mesmo horizonte.

Parcelas são descontadas do caixa após arrecadação e vencimentos. Se faltar caixa, a dívida permanece, os atrasos aparecem em vermelho e bloqueiam crédito novo. Caixa não fica negativo; a arrecadação seguinte regulariza as parcelas. Contratos vencidos não desaparecem sem pagamento.

Impostos variam de 0% a 30%, começando em 10%. Botões −/+ ajustam em 0,5 ponto percentual, sem cooldown. A renda dos trabalhadores é proporcional à alíquota (10% = R$ 3/s por trabalhador antes de pesquisa/crise); renda passiva de R$ 8/s é fixa. Cada ponto acima de 10% custa −0,15 POP/s; cada ponto abaixo gera +0,05 POP/s. Impostos não afetam diretamente a produção. Alterar impostos não muda o limite de crédito baseado na renda sustentável nem contratos assinados.

Popularidade varia de −200 a +200 e integra a variação líquida de impostos e estruturas culturais concluídas. De 0 a −200, produtividade dos trabalhadores cai linearmente de 100% a 40% (70% em −100). Abaixo de −100, produção de unidades e obras desacelera gradualmente até 75% em −200; pesquisas e geração cultural não sofrem essa penalidade. Obras aceleradas acumula multiplicativamente com a crise. Reduzir impostos e manter Feira/Estádio ativos permite recuperar estabilidade sem perder permanentemente unidades ou construções. Magias consomem popularidade a cada uso e precisam ser desbloqueadas uma vez por partida; depois o desbloqueio permanece mesmo se a popularidade cair. O HUD mostra saldo, variação por segundo e, no popover, as penalidades atuais.


### Eventos de popularidade e zoom

Feira/Estádio pronto oferece Mobilização local (R$ 180, 6s → +15 POP) e Grande evento (R$ 600, 15s → +60 POP). Pedidos são pagos ao entrar na fila de até cinco eventos por prédio e concluem em série, com ganho somente ao concluir. Crise reduz a velocidade; popularidade é limitada a 200 na conclusão. Demolir cancela pedidos sem reembolso. O HUD e o mapa mostram o progresso; portraits têm tempo no canto esquerdo e ganho no direito.

A câmera inicia em 67%, mostrando aproximadamente 50% mais largura de mundo. Botões −/+, slider e pinça no trackpad controlam zoom entre 60% e 160%. Teclas −/+ também funcionam; 0 restaura 67%. Scroll normal mantém a navegação. A pinça preserva o ponto sob o cursor, e o HUD permanece fixo. Indicadores dos prédios acompanham posição e escala no mesmo frame; o minimapa mostra a área visível atual.

### Pesquisas globais permanentes

Universidade popular / Instituto do mercado: R$ 1.800, construção de 45s, atalho U (esquerda) / I (direita) no terreno. Cada escola/universidade pesquisa uma tecnologia por vez; instituições diferentes permitem pesquisas paralelas. Cada tecnologia possui três níveis por civilização. O mesmo avanço não pode ser pesquisado em paralelo em prédios diferentes. O custo de cada nível é o preço-base × 1/2/3; os tempos são o tempo-base × 1/1,5/2 (arredondados). Os bônus são cumulativos.

| Tecnologia | Custo-base | Tempo-base | Bônus por nível |
|---|---:|---:|---|
| Tática de linha de frente | 180 | 20s | +5% ataque da linha de frente |
| Treino à distância | 180 | 20s | +5% ataque dos atiradores |
| Engenharia de cerco | 240 | 25s | +5% ataque do cerco |
| Saúde coletiva | 220 | 25s | +2% vida máxima de todas as unidades |
| Engenharia estrutural | 260 | 30s | +200 vida máxima e atual da base |
| Defesa territorial | 300 | 30s | −15% dano de ataques recebido pela base |

Ataque tem pesquisas independentes para linha de frente, atiradores e cerco: +5% por nível, até +15% para cada classe. Saúde chega a +6%, fortificação a +600 de vida da base e defesa a −45% de dano de ataques. Bônus valem para unidades existentes e futuras. Ao aumentar vida de unidades existentes, preserva-se o percentual de ferimento. Pesquisas são pagas ao iniciar; o ritmo das pesquisas não é afetado diretamente pelos impostos ou pela crise. Progresso e bônus ativos aparecem no HUD e no indicador da faculdade selecionada no mapa.

As ações do HUD usam botões quadrados de tamanho estável, inclusive construção, recrutamento, pesquisas e ofertas do Banco. O painel central tem largura compacta, enquanto o painel de ações ocupa o espaço restante. Quando os botões não cabem, a linha rola horizontalmente; a barra aparece sobre os elementos durante a rolagem e desaparece após 700ms, sem reservar espaço nem alterar a altura do HUD.

### População compartilhada

A base fornece 12 vagas. Moradias concluídas acrescentam 6, mais 2 por nível adicional, até 200 vagas. Trabalhadores, infantaria e atiradores usam 1; cerco usa 2 e heróis usam 3. A topbar mostra população ocupada (incluindo reservas) / capacidade.

Produções automáticas são pedidos consecutivos: antes de iniciar, reservam a população; ao concluir, convertem a reserva em unidade e tentam iniciar outro pedido. Sem vagas, aguardam com progresso zero e retomam automaticamente quando uma morte ou moradia libera capacidade. Pedidos manuais ficam na fila; somente o primeiro reserva população ao começar. O recrutamento manual continua cobrando R$ ao enfileirar; a produção automática cobra R$ por unidade ao iniciar, junto com a reserva de população.

O HUD permite pausar/retomar cada estrutura automática. Tropas já em treinamento concluem normalmente e não iniciam outro pedido; a reserva é convertida em unidade. Prédios de popularidade contribuem passivamente, sem pausa e sem ciclo visual periódico. Produção instantânea foi removida.

### Publicação no Netlify

`netlify.toml` publica `apps/web/dist`. O frontend oferece IA e multiplayer 1v1. `netlify.toml` habilita `VITE_ENABLE_ONLINE=true` e aponta `VITE_GAME_SERVER` para `wss://brwars-server.fly.dev`. Sem essa habilitação explícita, produção mantém o multiplayer oculto e bloqueado. Desenvolvimento local usa o servidor Bun na porta 2567.

Produção: https://brwars.netlify.app · Site Netlify `f816c8e6-7051-4355-a0f6-466b3613863e`. Para atualizar: `netlify deploy --prod --no-build --filter @brwars/web --site f816c8e6-7051-4355-a0f6-466b3613863e --dir apps/web/dist` após `bun run check`.

### Gameserver no Fly

App `brwars-server`, organização pessoal, região `gru` (São Paulo), uma máquina shared CPU com 512 MB, HTTPS/WSS e healthcheck `/health`. A máquina permanece ativa; as salas são mantidas na memória e reinícios/deploys interrompem partidas em andamento. Não aumentar o número de máquinas sem implementar o roteamento de salas/presença compartilhada do Colyseus.

Publicar: `fly deploy --remote-only --ha=false`. Validar o servidor público: `GAME_SERVER_URL=wss://brwars-server.fly.dev bun run test:integration`. Esse teste abre uma sala privada própria, conecta dois jogadores, testa sincronização/reconexão e encerra a sala. Não atua em partidas de usuários. Para publicar o frontend manualmente, primeiro gerar o build com `VITE_ENABLE_ONLINE=true VITE_GAME_SERVER=wss://brwars-server.fly.dev bun run check`, depois executar o deploy Netlify documentado acima.

### Mobilidade e obras

A universidade oferece Mobilização geral (R$ 200/25s): cada nível acrescenta 10% de movimento a todas as tropas, inclusive heróis. Trabalhadores permanecem na região da base. Obras aceleradas custa R$ 240/25s no primeiro nível e aumenta velocidade de construção/upgrades em 15% por nível (até +45%, duração dividida por 1,45). Todas seguem as regras de três níveis, custo e tempo crescentes das demais pesquisas. Os efeitos valem também para unidades e obras já existentes.

Melhorias de edifícios agora levam `8 + 2 × nível atual` segundos-base, cobrados em R$ ao iniciar. O nível e seus benefícios só mudam ao concluir. Produção e benefícios do nível atual continuam funcionando durante a melhoria; não é possível iniciar outra antes de terminar. Obras e melhorias usam a pesquisa de construção; a crise de popularidade afeta produção de unidades e obras; impostos afetam a variação de popularidade. Progresso/tempo restante aparecem no mapa e no HUD.

Infantaria custa R$ 40 por unidade; atiradores R$ 55; cerco R$ 100. Sem R$ ou população, nenhum recurso é consumido e o próximo pedido aguarda. Pedidos já iniciados estão pagos e terminam mesmo que o caixa seja gasto depois. Indicadores discretos acima dos prédios mostram automático/pausa e falta de população ou R$, inclusive quando ambos faltam.

### Expansão territorial

Cada civilização tem 48 terrenos: três fileiras de oito acima da estrada e três abaixo. Começa com seis terrenos próprios na primeira fileira inferior, incluindo o prédio inicial. Os demais custam R$ 150 cada; adquirir libera o catálogo, e construir continua custando separadamente. A posse é individual por facção e validada no servidor. Terrenos próprios mostram CONSTRUIR; os à venda mostram cadeado/preço. Clique para selecionar e use o botão Adquirir terreno no HUD ou atalho A. A IA também compra terrenos para expandir.

Demolir no HUD devolve 50% do custo-base do prédio + upgrades de nível pagos (inclui melhoria em andamento). O terreno continua próprio. Produção e pesquisa em andamento no prédio são canceladas; custos de unidades/pesquisas e aquisição do terreno não entram no reembolso. Bônus de pesquisas já concluídas continuam ativos. Demolir moradia reduz capacidade sem eliminar população existente; pedidos novos aguardam vagas.

### Pré-requisitos de construção

Universidade popular / Instituto do mercado exigem Escola do povo / Colégio do mérito concluídos. Escolas são independentes; hospitais exigem Escola. Heróis exigem Feira/Estádio concluído da própria facção. Garagem do povo / Garagem patriota exigem Rádio popular / Central do Zap concluídas. Requisitos pertencem à própria facção; obras ainda não prontas não desbloqueiam nada. Catálogo mostra botão cinza com o requisito faltante e atalhos respeitam o bloqueio. Servidor também valida, sem cobrar quando o requisito falta. Demolir o requisito volta a bloquear novos prédios dependentes, mas não cancela construções já iniciadas nem prédios prontos. A IA constrói e aguarda os requisitos. Vínculos são declarados em `BUILDING_REQUIREMENTS`.

Prédios com ciclo automático mostram a mesma barra amarela de produção da base, acima do topo opaco do sprite, sem precisar selecionar. A barra acompanha o progresso autoritativo de tropas e eventos de popularidade enfileirados. Sem recursos fica vazia; pedidos já iniciados concluem normalmente ao pausar o automático. Ícones de status ficam acima da barra.

### Estruturas que atacam

A base usa o sistema de armas de estruturas: ataque ranged de alvo único, 65 de dano, alcance 150 e intervalo de 1,3s. Atira na tropa inimiga viva mais próxima no alcance; nunca atinge aliados ou a outra base. Eventos de combate identificam origem base/prédio/unidade e geram projéteis dourados com trilha de partículas, saindo da base.

No HUD da base, Melhorar ataque oferece três melhorias: R$ 250/15s, R$ 500/20s, R$ 750/25s. Cada uma adiciona apenas 8 de dano (máximo 89); alcance/cadência permanecem fixos e bônus de ataque de tropas não se aplicam. Pesquisa de obras acelera a melhoria. A base continua atirando e recrutando durante a melhoria. Seu poder não cresce com o tempo: repele tropas iniciais, mas perde eficiência relativa contra tropas com níveis/pesquisas e ondas numerosas. Dano das estruturas e tropas resolve simultaneamente no servidor.

### HUD econômico compacto

Impostos ficam na barra superior em − / percentual / +. Ícones quadrados flutuam no canto esquerdo do mapa, sem painel opaco nem espaço reservado, em duas fileiras de contratos: dívidas com portrait e saída vermelha por segundo no rodapé; aplicações com portrait e rendimento equivalente verde por segundo no rodapé. Os nomes aparecem no tooltip e nos detalhes. As duas barras diminuem conforme o prazo expira. Atrasos ganham alerta; detalhes, quitação e resgate ficam ao clicar no ícone do contrato. O valor verde é rendimento equivalente acumulado: o caixa só recebe principal + rendimento no vencimento, conforme a mecânica existente. Não confundir com a renda líquida disponível da topbar.

### Pesquisas globais
As melhorias concluídas aparecem sobre o mapa em Exército, Econômico, Estrutural e Poderes globais, com nível de 1 a 3. Mobilização geral substitui as três pesquisas de movimento (+10% por nível para todas as tropas, inclusive heróis). Treinamento eficiente reduz em 10% por nível o tempo de toda produção de unidades. Formação profissional reduz mais 10% por nível o tempo de trabalhadores, acumulando multiplicativamente: ambos no nível 3 levam o tempo-base de 5s para 2,45s, antes das penalidades de crise. Produtividade do trabalho aumenta em 10% por nível a renda dos trabalhadores; a alíquota continua sendo aplicada sobre essa renda. Essas pesquisas não aceleram geração de popularidade, obras ou outras pesquisas.

Atalhos da construção selecionada: **P** pausa/retoma a produção automática (a unidade em curso termina normalmente); **D** demole e aplica o reembolso padrão. Valem apenas para construções aliadas, não para a base. As teclas aparecem nos botões e no manual.

Magias globais ficam em uma fileira de ícones no centro superior do campo, com custo de popularidade por uso no rodapé. Clique invoca a magia; os atalhos são 1, 2, 3 e 4. A recarga individual de cada magia aparece como uma sombra que se esvazia de cima para baixo. Descrições das magias e ícones de recursos, contratos e melhorias aparecem em um popover que acompanha o mouse, também disponível ao focar pelo teclado.

### Poderes globais
Duas pesquisas de três níveis na universidade: Estado de exceção (R$ 240/25s no primeiro nível) reduz a recarga de todas as magias em 10% por nível, até 30%; Propaganda eficiente (R$ 200/25s) reduz o custo de popularidade em 10% por nível, até 30%, arredondando para cima; não altera os requisitos de desbloqueio. Custos/tempos seguem a progressão das outras pesquisas. Nível 3: recarga-base de 45s passa a 31,5s e Chuva de boletos custa 42 POP por uso. A conclusão da pesquisa de recarga preserva a fração de progresso das recargas já em andamento. Efeitos só são aplicados ao concluir e valem apenas para a própria civilização. A categoria também aparece na lista de melhorias globais ativas.

### Diversificação e retorno marginal da popularidade
Feira cultural/Estádio: R$ 280, 18s, taxa-base +0,6 POP/s (R). Escola do povo/Colégio do mérito: R$ 650, 25s, +0,8 POP/s (S), sem requisito. Hospital popular/Hospital premium: R$ 1.200, 35s, +1 POP/s (J), requer Escola. Universidade agora requer Escola. Cada nível acrescenta 5% da taxa-base do tipo (máximo +70% no nível 15).

Dentro de cada tipo, prédios concluídos e ativos são ordenados por maior rendimento-base, depois terreno. Recebem pesos de 100%, 35%, 12,25%, 4,2875%… (`0,35^posição`). Tipos diferentes têm suas próprias curvas. Prédios em obra não geram popularidade nem ocupam posição; demolir, pausar, retomar e concluir uma melhoria recalcula o rendimento. Adicionar uma cópia fraca nunca reduz o total. Mesmo 48 prédios do mesmo tipo no nível 15 não compensam a perda de −3 POP/s dos impostos a 30%. O HUD mostra geração efetiva do selecionado e previsão da próxima cópia no popover do catálogo.

A popularidade no topo usa uma barra de −200 (vermelho) a +200 (verde), com ponteiro do saldo atual. Abaixo, seta vermelha/esquerda ou verde/direita indica tendência; seu comprimento cresce com a magnitude da variação, sem deslocar o layout. A taxa exata também aparece em POP/s e no popover.

### Escola, universidade e elenco de heróis
Escola (R$ 650/25s) pesquisa mobilidade, treinamento de unidades/trabalhadores e ataque das três classes. Universidade (R$ 1.800/45s, requer Escola) pesquisa produtividade, saúde coletiva, obras, fortificação, defesa e Poderes globais. O servidor valida a instituição correta; cada prédio tem sua própria fila de pesquisa. Ambas geram popularidade, inclusive enquanto pesquisam: +0,8 POP/s-base na Escola e +1,1 na Universidade, com curvas decrescentes separadas. A geração passiva de popularidade permanece sempre ativa. Melhorias de nível aumentam a taxa-base em 5% por nível, com as regras de custo/obra comuns.

Esquerda: Jones Manoel, Che Guevara, Stalin, Dilma e Lula. Direita: Mamãe Falei, Jorginho e Pavanato. Máximo três identidades diferentes adquiridas por jogador, incluindo heróis mortos e na fila; duplicar personagem é bloqueado. Cada um ocupa 3 de população; custo, treinamento, vida, dano e velocidade vêm de `HEROES`. Cada identidade é comprada uma única vez. Após morrer, só retorna pela recuperação no Hospital, preservando nível e XP. Cada herói possui cinco passivas de área; efeitos iguais da mesma passiva não acumulam. Sprite/portrait e nome acompanham identidade no mapa, na seleção e na produção. Cards mostram relógio/tempo no canto superior esquerdo e população no superior direito, com backdrop; custo fica no rodapé. Tempo exibido considera pesquisas e crise.

O nascimento incrementa um serial autoritativo: a chegada divina toca uma vez por recrutamento, com feixe, auréola e partículas acompanhando o herói. Carregar um mapa com herói já existente não repete o efeito.


### Progressão e recuperação de heróis

Heróis vão do nível 1 ao 10. Mortes inimigas próximas (raio lógico 160), mesmo causadas por tropas, base ou magia, distribuem XP entre os heróis aliados vivos próximos: infantaria 25, atirador 30, cerco 60, herói 120, com +15% por nível adicional da vítima. O nível 2 exige 100 XP; cada intervalo seguinte exige mais 50. Cada nível concede +12% da vida-base e +10% do dano-base; subir preserva a porcentagem de vida. Heróis mortos não recebem XP.

Cada Hospital pronto pode recuperar um herói por vez. O tempo-base é 8s, afetado por treinamento e crise. A primeira recuperação custa 50% do recrutamento; cada recuperação concluída multiplica o próximo preço por 1,5. O pedido paga R$ imediatamente e aguarda/reserva 3 vagas de população antes de avançar. Demolir o Hospital cancela a recuperação e libera as vagas, sem devolver o pagamento. Mortos continuam ocupando uma das três identidades do elenco, mas não população.

O HUD à esquerda mostra os portraits dos heróis adquiridos, nível no canto superior direito, vida e XP abaixo. Mortos/em recuperação ficam esmaecidos. Clicar em um vivo seleciona a unidade e centraliza a câmera. Detalhes ficam no popover. Cards de pesquisas mostram nível no canto superior direito e nome/custo; bônus atual e próximo aparecem no popover com números destacados. Mobilização geral, Treinamento eficiente e Tática de linha de frente têm portraits distintos (bota, ampulheta e livro de espadas).

Clicar no portrait lateral de um herói morto abre sua seleção no HUD, com ação de recuperação, custo e tempo ajustado pelas pesquisas/crise. O comando escolhe automaticamente um Hospital concluído e livre. Sem Hospital ou com todos ocupados, o card mantém os valores visíveis e informa o bloqueio. A seleção acompanha a recuperação e volta a inspecionar a unidade quando ela retorna ao mapa.


### Inauguração, primeiro herói e adversário automático

Prédios de popularidade concedem um bônus uma única vez ao concluir: Feira/Estádio +6, Escola +8, Hospital +10, Universidade +11 POP, multiplicado pelo retorno marginal do tipo. Depois contribuem apenas para POP/s; melhorar o prédio não repete a inauguração. Eventos comprados são a fonte de ganhos diretos posteriores.

O primeiro herói adquirido é gratuito (R$ 0), contando pedidos já na fila. Os demais custam o preço normal. Requisito cultural, tempo e população continuam válidos; Hospital usa a regra própria de custo de recuperação. A fila guarda o valor realmente pago. No mapa, heróis crescem gradualmente acima do primeiro nível, até +36% no nível 100, com sombra, seleção e posição da vida acompanhando a escala.

A IA usa os mesmos comandos e custos do jogador, sem renda extra. Prioriza moradia antes do bloqueio de população, amplia trabalhadores até 18, combina infantaria/atiradores/cerco conforme o adversário, poupa reduzindo produção para Escola e Universidade, pesquisa nas duas instituições, recruta e recupera heróis, expande terrenos e aprimora tropas. Ajusta impostos pela geração cultural e estabilidade, reage a invasões com magias independentes e preserva reservas de caixa; só usa crédito emergencial e investe excedentes. Decisões permanecem determinísticas a cada quatro segundos.


### Heróis equivalentes e passivas de área

Todos custam R$ 480 e levam 12s-base para treinar (primeiro grátis). Os atributos usam um orçamento comum: 50% vida, 35% dano por segundo, 10% movimento, 5% alcance, normalizados pelo perfil equilibrado. Isso estabelece um ponto inicial comparável, não garante a mesma taxa de vitória. Tanques trocam dano/movimento por vida; heróis ágeis fazem a troca inversa. A recuperação inicial no Hospital custa R$ 240, crescendo 50% por recuperação concluída.

O segundo herói adquirido exige Universidade/Instituto pronto da própria facção; o terceiro exige também pelo menos 100 de população máxima. Mortos e pedidos na fila contam como identidades adquiridas. Não é necessário ocupar 100 vagas. Os requisitos de novas aquisições não impedem recuperar um herói já adquirido.

Cada herói tem cinco passivas, liberadas em níveis 1, 3, 8, 35 e 75, raio lógico 140. Alvos podem ser aliados/inimigos e infantaria, atiradores, cerco ou todas as unidades. Dano, alcance, movimento, dano recebido e velocidade de ataque são calculados autoritativamente pela posição e nível do emissor. Sair da área ou perder o emissor remove o efeito. Modificadores distintos somam, limitados entre 50% e 150%; a mesma passiva não acumula. A proteção também reduz dano da Chuva de boletos. A antiga aura universal de +20% foi removida.

Ícones verdes/vermelhos aparecem acima da vida, agrupando atributo e direção; as magias de força e silêncio também aparecem. Selecionar o herói mostra sua área no mapa e as cinco passivas no painel de comandos, com níveis bloqueados visíveis. Selecionar uma unidade mostra os efeitos ativos; popovers destacam porcentagem, área e fonte.

O painel de produção mostra apenas portrait, nome, barra e ícones da fila. Tempo, custo, população e bloqueios ficam no popover numérico, sem porcentagem ou contador de fila visível. Prédios culturais não podem mais pausar a contribuição de popularidade, nem por comandos antigos; a flag antiga é ignorada para esse cálculo.

Atributos da unidade ficam em uma única linha de ícones: dano, alcance, movimento, população e nível. Os rótulos curtos aparecem no popover ao passar o mouse. As frases de avanço/combate automático foram removidas.

Produção automática de tropas mantém o feedback visual e não toca aviso sonoro a cada unidade.

### Médico Cubano

Suporte exclusivo da Esquerda, recrutado manualmente na Base (M): R$ 220, 10s-base, 2 de população, 100 PV e movimento 20. Usa a mesma fila de trabalhadores/heróis, com pagamento e reserva de população no início. Não ocupa vaga do elenco de heróis nem consome o primeiro herói gratuito. Treinamento eficiente, mobilidade e vitalidade também o afetam.

A aura Plantão solidário cura 5 PV/s em tropas e heróis aliados vivos num raio lógico 140, incluindo o próprio médico. Não cura bases, inimigos nem mortos, não ultrapassa a vida máxima e não acumula com outros médicos. O médico acompanha a retaguarda e se afasta de inimigos próximos, sem atacar. A cura é autoritativa, aplicada após resolver danos e baixas. Aliados na área mostram ícone verde de cura; feridos recebem partículas de cruzes verdes, sem aviso sonoro repetitivo. O HUD mostra cura por segundo no lugar de dano. A IA da Esquerda também recruta suporte proporcional ao exército.

Regras atuais de cura, recuperacao e recuo: [ajustes de balanceamento](docs/balance-notes.md).

### Desbloqueio dos poderes globais

| Magia | Requisitos iniciais para desbloquear | Custo-base por uso |
|---|---|---:|
| Chuva de boletos | Banco concluído | 60 POP |
| Recuar tropas | Escola concluída | 80 POP |
| Modo avião | Feira/Estádio concluído | 70 POP |
| Agora vai! | Universidade e Hospital concluídos | 75 POP |

Desbloqueios são permanentes dentro da partida e sincronizados pelo servidor. Obras incompletas não contam. Usos rejeitados por saldo, recarga ou falta de alvos não cobram nada. A IA segue as mesmas regras.

### Heróis: resistência e reaparição

A vida-base de todos os heróis foi multiplicada por 3, preservando dano, velocidade, alcance e progressão percentual por nível. O elenco da Direita é Mamãefalei, Trump, Bolsonaro e Pablo Marçal. O atlas de Jorginho fica reservado para uma futura unidade de beach tennis. A fala disponível toca em cada entrada em campo, inclusive no revive. O efeito divino com auréola aparece somente nas ressurreições, não no recrutamento inicial.

### Nomes dos prédios e teclas

Os nomes em jogo seguem o catálogo de [docs/building-names.md](docs/building-names.md): INSPER e Federal Sucateada, Escritório, Banco do Primo Rico, Colégio do Mérito e Hospital Particular, entre outros. Letras presentes no nome continuam destacadas; teclas ausentes aparecem como `Nome [tecla]`, com a tecla amarela e sem trocar os atalhos existentes.

### Perspectiva e suporte

A apresentação coloca o jogador sempre à esquerda atacando para a direita, inclusive ao escolher a facção Direita. Minimap, alvos da câmera, marcadores, tropas, trabalhadores e efeitos usam a mesma projeção; a simulação e as identidades das facções permanecem canônicas. A Direita pode recrutar o Médico do Convênio na Base, com as mesmas regras de cura e custos do Médico Cubano. Arte e prompt em [docs/private-medic-assets.md](docs/private-medic-assets.md).

Cards de recrutamento usam somente tempo no canto superior esquerdo, população no superior direito, nome e custo no rodapé. Requisitos de prédios aparecem no popover com portraits e a seção Requisitos, cinza para prédios ausentes ou ainda em construção. A barra de recursos usa UserGear para TRAB. e UsersThree para População.

Empregos agora limitam a renda dos trabalhadores. A Base oferece 6 vagas; prédios contribuem marginalmente e Coop. do Povo / Startup oferecem 12, mais 4 por nível. HUD TRABALHO mostra trabalhadores / empregos; o popover detalha desemprego. Regras e prompt da arte: [docs/employment.md](docs/employment.md).


Heróis agora evoluem até nível 100, com XP por abates e cinco passivas desbloqueadas nos níveis 1/3/8/35/75. O crescimento visual de até 36% é distribuído pela nova escala. Vida, dano e custo de revive continuam escalando por nível. Jones e Stalin têm áudios próprios de entrada/revive; Lula usa a fala substituta solicitada. A morte de um herói aliado ou inimigo toca um efeito dramático exclusivo, sem repetição por snapshot. Fontes e recortes: docs/meme-audio-catalog.md.

O mapa mostra um controle compacto `NV. X + UP` abaixo de cada prédio próprio pronto, mesmo sem seleção. UP respeita caixa, estado da partida, melhoria em andamento e nível máximo; a barra listrada se acopla abaixo durante o upgrade, substituindo o painel anterior. Depois de uma melhoria confirmada pela simulação, um texto Phaser vermelho com contorno mostra `− R$ custo`, sobe a partir do clique e desaparece. O ponto é convertido do overlay para coordenadas do mundo, acompanhando câmera e zoom; cliques por teclado usam o centro do botão. Pedidos recusados não geram feedback de gasto.


Vagas de prédios comuns agora dependem de atividade efetiva: pesquisas, eventos, recuperação ou produção iniciada. Banco oferece uma vaga enquanto administra contratos ativos, sem multiplicação por bancos repetidos. Startup/Coop. mantém suas vagas disponíveis mesmo sem produção e as 6 vagas iniciais da Base continuam permanentes. Ociosidade remove vagas e afeta renda e POP/s automaticamente.


Prédios de combate, moradias e locais de emprego evoluem até o nível 15. Moradias começam com 6 vagas de população e ganham +2 por nível adicional; Startup/Coop. começa com 12 empregos e ganha +4 por nível adicional. Os benefícios entram ao concluir a melhoria, com custo exponencial. Médico foi movido da Base para fila manual no Hospital, sempre nível 1. Banco usa limite e ofertas que crescem com a renda sustentável, sem níveis. Regras completas: [docs/economy-and-hospital.md](docs/economy-and-hospital.md). O HUD de popularidade mantém só a seta de tendência ancorada no centro; o valor de POP/s fica no popover. Overscroll nativo foi desativado na raiz e páginas mantidas em BFCache preservam o runtime da sessão ao voltar.

A entrada tem splash HTML imediato e loading de progresso real. Phaser baixa/prepara as texturas e aguarda o primeiro frame; portraits do HUD são decodificados, todas as fontes são carregadas e música/SFX baixados antes de liberar o botão Entrar na batalha. A simulação local só é assinada/iniciada depois do preparo e do clique. O gesto desbloqueia o mixer e decodifica os SFX já baixados sem repetir downloads. Erros de assets mantêm o jogo bloqueado com Tentar novamente. Troca de facção reutiliza o cache e aguarda a nova cena.

O HUD usa 18 portraits de rosto/busto próprios para heróis, trabalhadores, médicos e tropas, sem reutilizar frames de animação. Recrutamento, fila, produção, roster e seleção compartilham a mesma arte e recorte quadrado; tempo/população/nome/custo preservam seus slots. Os quatro atlas entram no pré-carregamento. Prompts e catálogo: [docs/unit-portraits.md](docs/unit-portraits.md).
