# Backlog do Infiltrados no Congresso

Auditoria de 13/11/2026 sobre `b14ea6b0d083d9894754b85901edd26c59b2b559`. A branch auditada inclui o PR #15 aberto. Os PRs #8 a #14 relevantes foram mesclados. Os estados descrevem a branch auditada.

Edite o estado e a observação da linha correspondente para manter o painel atualizado. A versão servida por HTTP lê este Markdown. O HTML também inclui uma cópia offline.

A evidência por área aponta para `apps/sessao/src` e `apps/sessao/server`. Arquivos nas linhas referenciam os fluxos, e a revisão cruzada está em [gameplay-audit.md](gameplay-audit.md).

## SYS

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| SYS-01 | Inicialização e encerramento de partidas | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-02 | Lobby e gerenciamento de participantes | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-03 | Quantidade mínima e máxima de jogadores humanos | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | Produção exige seis humanos e limita a sala a seis. O modo solo é configuração de teste/local. | — |
| SYS-04 | Seleção de personagens antes da partida | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-05 | Sincronização multiplayer em tempo real | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-06 | Reconexão e recuperação do estado | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-07 | Autoridade do servidor sobre regras de gameplay | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-08 | Sistema de eventos de domínio | PARCIAL | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | Eventos tipados de gameplay alimentam missões e economia. A cobertura não é uniforme entre domínios. | Média |
| SYS-09 | Interações contextuais com objetos e personagens | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-10 | Interações canalizadas com duração e interrupção | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-11 | Sistema global de notificações | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-12 | Controle de fases e temporizadores da partida | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-13 | Configurações centralizadas de balanceamento | PARCIAL | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | Constantes ficam por domínio, com valores ainda locais nos controladores e na interface. | Baixa |
| SYS-14 | Proteção contra duplicação e concorrência de comandos | PARCIAL | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | Tokens, revisão e validação de posse cobrem ações críticas. Negociação, campanha, publicação, perícia, denúncia, ações de plenário, intenções e votos exigem uma sequência compartilhada por sessão de sala. O teste de audiência confirma que um voto prematuro reenviado não sobrescreve um voto válido. O teste multiplayer rejeita republicação mesmo após liberar o intervalo e valida o fluxo de perícia com token novo. Testes no cliente e por socket cobrem reenvio com valor alterado e reutilização entre canais. Falta política uniforme de replay. | Média |
| SYS-15 | Observabilidade, logs e métricas de gameplay | PARCIAL | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | Há logs estruturados de economia e XP. Falta painel de métricas e alertas. | Média |
| SYS-16 | Tratamento consistente de desconexões definitivas | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-17 | Persistência do estado durante a partida | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | A reconexão preserva o estado enquanto a sala está ativa. Socket verifica XP, agenda, carteira e equipamento; cliente retoma a sequência de movimentos. | — |
| SYS-18 | Testes automatizados de regras de gameplay | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |
| SYS-19 | Sistema de áudio e gerenciamento de SFX | IMPLEMENTADO | SessionRoom.ts, PlenaryMatch.ts, SessionRoom.test.ts, game-audio.ts; PR 8, 11, 15 | — | — |

## MAP

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| MAP-01 | Mapa top-down, movimentação e colisões | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-02 | Fog of war respeitando paredes e geometria | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | A iluminação é recortada por paredes e portas fechadas. Testes verificam o recorte no cliente e a ocultação de atores no servidor. | — |
| MAP-03 | Salas e regiões identificáveis | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-04 | Portas e obstáculos interativos | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-05 | Plenário: teletransporte e confinamento em sessões | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-06 | Plenário com espaço adequado para os participantes | IMPLEMENTADO | SessionRoom.test.ts, plenary-camera.test.ts | Seis clientes recebem seis humanos e três NPCs em assentos distintos. Testes de enquadramento em três dimensões de mapa e conferência visual no Chrome com sala cheia. | — |
| MAP-07 | Pontos de interação e objetos distribuídos pelo mapa | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-08 | Pathfinding e navegação de NPCs | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-09 | Objetos descartáveis e coletáveis no chão | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-10 | Diferentes rotas e pontos estratégicos de circulação | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-11 | Integração entre portas, fog of war e áudio | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-12 | Sala de Segurança com terminal de vigilância | PENDENTE | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | Central pessoal de Vigilância existe. Falta sala pública com terminal. | Média |
| MAP-13 | Câmeras institucionais fixas em áreas comuns | PENDENTE | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | Existem câmeras escondidas dos jogadores. Falta rede institucional fixa. | Média |
| MAP-14 | Distribuição estratégica de esconderijos para dispositivos | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-15 | Sala de Reprografia para adulteração documental | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-16 | Sala de isolamento para afastamentos | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | Sala física no mapa, com posição de isolamento e ponto de retorno. Coberta por teste de cliente e socket. | — |
| MAP-17 | Tesouraria funcional | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-18 | Secretaria e Protocolo funcionais | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |
| MAP-19 | Corregedoria funcional | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Balcão abre o fluxo de denúncia formal para ocorrências registradas e mantém auditoria e comunicados. | — |
| MAP-20 | Cafezinho/Cantina com NPC vendedor de alimentos | IMPLEMENTADO | map.ts, draw-map.ts, navigation.ts, SessionRoom.test.ts; PR 8, 12, 13, 15 | — | — |

## CHAR

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| CHAR-01 | Personagens políticos selecionáveis e representações visuais | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-02 | Atributos individuais por personagem | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-03 | PV e sistema de dano | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-04 | ATK e cálculo de ataque | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-05 | DEF e mitigação de dano | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-06 | Stamina e regeneração | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-07 | Corrida e consumo de stamina | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-08 | Corrida condicionada ao Tênis de Corrida da Senhora | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-09 | Ataques com cooldown e custo de stamina | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | O porrete consome 10 de stamina por golpe. Teste Bun cobre recarga e rejeição sem gasto. Chrome validou o atalho Espaço e o aviso de stamina insuficiente. | — |
| CHAR-10 | Armas e combate corpo a corpo | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-11 | Porrete funcional | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-12 | Nocaute no lugar de eliminação física | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-13 | Recuperação automática após nocaute | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | Combat.ts recupera após oito segundos; o Plenário também encerra o nocaute. | — |
| CHAR-14 | Transporte de personagens nocauteados | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-15 | Extensão limitada do nocaute durante transporte | PENDENTE | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | Transporte acompanha o jogador e termina na recuperação. Falta extensão limitada do nocaute. | Média |
| CHAR-16 | Socorro e recuperação com itens médicos | IMPLEMENTADO | medical.ts, Gameplay.ts, Foundations.test.ts, gameplay-panel.tsx, gameplay.test.ts | Kit portátil comprado no Apoio Técnico, consumido pelo dono para recuperar até 35 PV. Testes cobrem custo, posse, limite de cura, replay e atalho. | — |
| CHAR-17 | Enfermaria e recuperação de PV | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-18 | Imunidade temporária após nocaute | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-19 | XP acumulado durante a partida | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-20 | Níveis e curva de progressão | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-21 | Pontos de atributo por level up | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-22 | Evolução de PV | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-23 | Evolução de Stamina | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-24 | Evolução de ATK | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-25 | Evolução de DEF | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-26 | Distribuição manual de pontos | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-27 | Modal de level up com animação e SFX | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-28 | Reinicialização de XP e níveis em nova partida | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-29 | Integração entre atributos, equipamentos e buffs | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |
| CHAR-30 | Indicadores de identidade, status e objetos transportados | IMPLEMENTADO | Combat.ts, Transport.ts, CharacterProgression.ts, Foundations.test.ts, progression-hud.tsx; PR 12, 15 | — | — |

## POL

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| POL-01 | Facções secretas: Parlamentares e Infiltrados | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-02 | Atribuição de facções conforme quantidade de jogadores | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-03 | Fases de articulação e votação | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-04 | Votação de projetos no Plenário | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-05 | Consequências institucionais dos projetos | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-06 | Catálogo finito de projetos com efeitos configurados | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-07 | Projetos benéficos e prejudiciais | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-08 | Projetos relacionados ao Orçamento Público | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-09 | Projetos relacionados a crises e infraestrutura | PENDENTE | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | Catálogo afeta estabilidade e orçamento. Falta integração com crises de infraestrutura. | Alta |
| POL-10 | Apresentação e protocolo de projetos | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | Projetos protocolados entram na pauta da rodada em ordem de protocolo. Na falta de propostas, entra o projeto padrão. | — |
| POL-11 | Requisitos de assinatura para projetos | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | Protocolo exige carimbos e assinaturas válidas para agendar. Socket cobre documento válido e recusa do adulterado; cliente resolve projeto e histórico por identificador. | — |
| POL-12 | Emendas e alterações legítimas de projetos | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-13 | Intenções e compromissos de voto | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | Intenção pública e revogável no HUD; voto independente. Testes cobrem publicação, retirada, voto contrário e limpeza. | — |
| POL-14 | Apuração autoritativa | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-15 | Estabilidade Institucional como condição coletiva | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-16 | Vitória dos Infiltrados por colapso | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-17 | Vitória dos Parlamentares por sobrevivência até o fim | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-18 | Vitória dos Parlamentares quando todos os Infiltrados perdem mandato | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |
| POL-19 | Efeitos de crises e projetos sobre a Estabilidade | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| POL-20 | Não revelar facção por comportamentos econômicos suspeitos | IMPLEMENTADO | PlenaryMatch.ts, PlenaryMatch.test.ts, PoliticalEconomy.ts, Gameplay.ts; PR 8, 14, 15 | — | — |

## ELE

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| ELE-01 | Cargos políticos existentes no domínio | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | Renovação usa mandato único, por decisão de produto. Testes validam a apuração no servidor e a apresentação no cliente. | — |
| ELE-02 | Sistema de eleições periódicas | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-03 | Popularidade individual | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-04 | Campanhas financiadas com patrimônio pessoal | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-05 | Pesquisas e projeções eleitorais | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-06 | Pronunciamentos e propaganda eleitoral | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-07 | Endossos e articulações eleitorais | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-08 | Renovação de Mandato como disputa única | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-09 | Apenas humanos com mandato participam da Renovação | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-10 | Perda de mandato do último colocado | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-11 | Apenas uma perda de mandato por ciclo | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-12 | Duração e quantidade configuráveis de ciclos | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-13 | Quantidade mínima de humanos para iniciar | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | ElectionCycle.test.ts verifica que NPCs não contam para o mínimo de seis humanos. | — |
| ELE-14 | Limite mínimo de parlamentares ativos | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-15 | Estado de Ex-parlamentar | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-16 | Identificação pública de Ex-parlamentar | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-17 | Bloqueio de voto e ações institucionais após perda de mandato | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-18 | Suspensão do salário parlamentar após perda de mandato | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-19 | Ex-parlamentar continua circulando e interagindo fisicamente | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-20 | Ex-parlamentar fora de futuras renovações | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-21 | Equalização inicial de salários e poderes dos cargos | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-22 | Ocultação temporária da hierarquia Presidente/Senador/Deputado | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-23 | Resultado eleitoral com apresentação visual e SFX | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-24 | Verificação de vitória pela eliminação de todos os Infiltrados | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-25 | Nenhuma perda direta de Estabilidade por perda de mandato | IMPLEMENTADO | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | — | — |
| ELE-26 | Ocupações alternativas para Ex-parlamentares — FUTURO | PENDENTE | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | O ex-parlamentar permanece no mapa; faltam ocupações alternativas. | Alta |
| ELE-27 | Evolução de carreira e diferenciação de cargos — FUTURO | PENDENTE | ElectionCycle.ts, ElectionCycle.test.ts, PlenaryMatch.ts, results.tsx; PR 14, 15 | Não há carreira ou progressão entre cargos no ciclo atual. | Alta |

## ECO

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| ECO-01 | Patrimônio monetário pessoal | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-02 | Orçamento Público e Estabilidade | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-03 | Pagamentos periódicos de salários | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-04 | Transferência financeira entre jogadores | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-05 | Pagamentos e subornos | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-06 | Dinheiro físico transportável | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-07 | Spawn aleatório de dinheiro no mapa | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-08 | Maletas com valores monetários | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-09 | Maços de dinheiro | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-10 | Remoção da Cueca de Dólar como dinheiro coletável | SUBSTITUÍDO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | A cueca coletável foi substituída pela Cueca do Mensalão, que oculta dinheiro. | — |
| ECO-11 | Indicadores de dinheiro transportado | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-12 | Coleta sem crédito imediato ao patrimônio | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-13 | Embolso exclusivamente no cofre próprio | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-14 | Entrega de dinheiro físico à Tesouraria | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-15 | Origem narrativa: impostos dos contribuintes | NÃO VERIFICÁVEL | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | A emissão tem regras contábeis e logs. Falta evidência de apresentação sistemática como imposto ao jogador. | — |
| ECO-16 | Maletas como única emissão monetária recorrente | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | A geração recorrente cria exclusivamente maletas. Teste Bun cobre geração, visibilidade e custódia. Chrome validou coleta por Objetos próximos e entrada no inventário. | — |
| ECO-17 | Salários debitados do Orçamento Público | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-18 | Pagamento proporcional de salários em caso de insuficiência | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-19 | Salários de humanos e NPCs na mesma folha | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-20 | Despesas públicas financiadas pelo Orçamento | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-21 | Divisão configurável entre salários e benefícios públicos | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-22 | Realocação de excedentes entre despesas | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-23 | Déficit público afetando Estabilidade | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-24 | Contribuições à Tesouraria e efeitos de popularidade | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-25 | Gastos em lojas e campanhas contabilizados corretamente | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-26 | Patrimônio pessoal representado pelo cofre do gabinete | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-27 | Roubo do patrimônio monetário do cofre | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-28 | Conversão de dinheiro roubado em objeto físico | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |
| ECO-29 | Integridade monetária sem duplicações | PARCIAL | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | Há testes de custódia, compra e resgate sem duplicação. A reconciliação cobre emissão, transferências, taxas, Tesouraria, projetos e folha. Roubo de cofre, descarte, coleta e resgate repetido também foram reconciliados. O teste de socket verifica que transferências e investimentos eleitorais repetidos, inclusive entre canais, não alteram os saldos duas vezes. Falta cobertura abrangente para todas as combinações de operações. | Média |
| ECO-30 | Métricas de criação, circulação e destinação de dinheiro | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | Resumo estruturado por sala reconcilia emissão, expiração, transferências, taxas, Tesouraria, salários, serviços públicos e projetos. Testes exercitam operações do servidor e conferem a diferença contábil. | — |
| ECO-31 | Empréstimos e acordos financeiros informais | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | Empréstimo informal usa transferências manuais para entrega e devolução. Testes verificam comandos do HUD e conservação dos dois saldos. | — |
| ECO-32 | Pagamentos e promessas entre jogadores sem execução automática de acordos verbais | IMPLEMENTADO | PoliticalEconomy.ts, PlenaryMatch.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 14, 15 | — | — |

## GAB

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| GAB-01 | Quantidade fixa de gabinetes | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-02 | Gabinetes espalhados estrategicamente pelo mapa | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-03 | Atribuição aleatória por partida | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-04 | Titularidade independente do cargo | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-05 | Gabinetes vazios e acessíveis | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-06 | Identificação do titular na porta | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-07 | Porta abrível, fechável e trancável | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-08 | Entrada de visitantes | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-09 | Prevenção de aprisionamento | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-10 | Cofre como ponto de embolso | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-11 | Armário/stash com slots | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-12 | Guardar e retirar itens | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-13 | Guardar documentos e dinheiro físico | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-14 | Níveis independentes de segurança | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-15 | Arrombamento de portas | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-16 | Arrombamento de armários | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-17 | Arrombamento de cofres | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-18 | Ferramentas de arrombamento compráveis | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-19 | Melhorias de fechaduras | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-20 | Acesso temporário após arrombamento | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-21 | Roubo e inserção de objetos em stash invadido | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-22 | Proteção de stash com titular presente | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-23 | Proteção de cofre com titular presente | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-24 | Proteção mantida com titular nocauteado na sala | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | PrivateOffices.test.ts testa que o cofre continua protegido com titular nocauteado dentro. | — |
| GAB-25 | Bloqueio de saques em sessões plenárias obrigatórias | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-26 | Decoração com slots predeterminados | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-27 | Compra e instalação de móveis | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-28 | Remoção e substituição de decoração | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | Remoção usa office-remove; o slot liberado aceita instalação de outro móvel. | — |
| GAB-29 | Objetos luxuosos visíveis e fotografáveis | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-30 | Eventos de decoração integrados às missões | IMPLEMENTADO | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | — | — |
| GAB-31 | Compra de gabinetes extras — FUTURO | PENDENTE | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | Não há aquisição de gabinete adicional. | Alta |
| GAB-32 | Troca negociada de gabinetes — FUTURO | PENDENTE | PrivateOffices.ts, private-offices.ts, Gameplay.ts, PrivateOffices.test.ts; PR 12, 15 | Não há troca autoritativa da titularidade de gabinetes. | Alta |

## ITEM

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| ITEM-01 | Inventário com slots | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-02 | Equipamento e desequipamento | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-03 | Uso de consumíveis | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-04 | Coleta e descarte de itens | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-05 | Transferência entre jogadores | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-06 | Itens com quantidade e stack | PARCIAL | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | Cargas e fatias têm quantidade. Inventário usa instâncias por slot, sem stack genérico. | Média |
| ITEM-07 | Equipamentos com cargas | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-08 | Recarga de equipamentos | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-09 | Buffs e debuffs temporários | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-10 | Validação autoritativa dos efeitos | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-11 | Loja do Apoio Técnico | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-12 | Cantina com vendedor independente | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-13 | Catálogo de alimentos e bebidas | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-14 | Pizza recuperando PV | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-15 | Café recuperando stamina | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-16 | Energético aumentando regeneração | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-17 | Coxinha e outros alimentos comuns | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-18 | Caixa de Bombom | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-19 | Leite Condensado | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-20 | Prato de R$ 1 | SUBSTITUÍDO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | O prato saiu do catálogo da Lanchonete. | — |
| ITEM-21 | Pão com Mortadela | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-22 | Picanha | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-23 | Lagosta | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-24 | Kit médico | PENDENTE | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | Enfermaria e socorro existem sem kit carregável. | Média |
| ITEM-25 | Colete de proteção | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-26 | Tênis de Corrida da Senhora | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-27 | Relógio esportivo e outros equipamentos de stamina | PENDENTE | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | Tênis e consumíveis afetam stamina. Falta relógio esportivo. | Baixa |
| ITEM-28 | Cueca do Mensalão | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-29 | Raio X | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-30 | Efeito visual privado do Raio X | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-31 | Sigilo de 100 Anos | PENDENTE | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | Ocultação da Cueca existe. Falta equipamento Sigilo de 100 Anos. | Média |
| ITEM-32 | Modulador de Voz | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-33 | Megafone | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-34 | Detector de escutas e câmeras | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-35 | Ferramentas de arrombamento | IMPLEMENTADO | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | — | — |
| ITEM-36 | Kit de Perícia | IMPLEMENTADO | gameplay.ts, gameplay.test.ts, Documents.multiplayer.test.ts, retrato-kit-pericia.webp | Compra, consumo e laudos autêntico e adulterado testados por socket. Loja e inventário usam o retrato WebP exclusivo do catálogo. | — |
| ITEM-37 | Pipeline de geração de ícones consistente com a direção artística | PARCIAL | gameplay.ts, equipment.ts, food.ts, Gameplay.ts, market-panel.tsx, Foundations.test.ts; PR 12, 15 | Catálogo usa retratos WEBP; parte dos itens reaproveita arte. Falta padrão verificável para todos os assets. | Baixa |

## NPC

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| NPC-01 | NPCs parlamentares autônomos | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-02 | Identidade própria | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-03 | Atributos físicos e combate | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-04 | Navegação e rotinas pelo Congresso | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-05 | Diálogos contextuais | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-06 | Personalidades e preferências | PARCIAL | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Perfis e decisões simples existem. Falta memória social e preferências duráveis. | Alta |
| NPC-07 | Saldo monetário real | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-08 | Patrimônio inicial aleatório | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-09 | Salários pagos pelo orçamento | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-10 | Solicitação de assinaturas | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-11 | Venda de assinaturas | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-12 | Assinaturas gratuitas conforme comportamento | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-13 | Intenção de voto por projeto | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-14 | Venda de votos | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-15 | Ofertas concorrentes precisam superar a anterior | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-16 | Compromisso de voto preservado após roubo | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-17 | Votação efetiva no Plenário | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-18 | Peso político equilibrado com humanos | NÃO VERIFICÁVEL | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Há voto computado e regras de quórum. Falta evidência de balanceamento empírico humano/NPC. | — |
| NPC-19 | NPCs podem sofrer dano | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-20 | Nocaute e recuperação | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-21 | Roubo integral do saldo | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-22 | Roubo gera dinheiro físico | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-23 | Sem reposição gratuita de patrimônio após roubo | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |
| NPC-24 | Reação e fuga durante agressões | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Rotinas param em combate/nocaute. Falta fuga reativa baseada na agressão. | Alta |
| NPC-25 | Identificação perceptiva do agressor | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Eventos têm testemunhas. Falta identificação persistente do agressor pelo NPC. | Alta |
| NPC-26 | Agressão furtiva utilizando equipamentos | PARCIAL | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Combate, fog e itens existem. Falta regra de agressão furtiva ligada à percepção de NPCs. | Alta |
| NPC-27 | Memória individual de agressores | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Falta memória individual de agressões. | Alta |
| NPC-28 | Desconfiança e preços maiores | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Preços negociáveis existem. Falta aumento por desconfiança. | Média |
| NPC-29 | Recusa de futuras negociações | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Recusas por elegibilidade existem. Falta recusa persistente por agressão anterior. | Média |
| NPC-30 | Hostilidade e retaliação contra agressores | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Falta comportamento autônomo de retaliação. | Alta |
| NPC-31 | Denúncia presencial à Corregedoria | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Falta trajetória autônoma até a Corregedoria para registrar denúncia. | Alta |
| NPC-32 | Denúncia pública com perda de popularidade | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Perda de popularidade existe em escândalos. Falta denúncia pública originada por NPC. | Alta |
| NPC-33 | Proteção contra denúncias duplicadas | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Falta o fluxo de denúncias de NPC com chave de deduplicação. | Média |
| NPC-34 | Distinção entre testemunhar agressão e identificar roubo | PENDENTE | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | Eventos registram hit e roubo separadamente. Falta política de conhecimento e denúncia de NPC. | Alta |
| NPC-35 | NPCs fora da Renovação de Mandato | IMPLEMENTADO | Parliamentarians.ts, ParliamentarianTalk.ts, Parliamentarians.test.ts, PoliticalEconomy.ts; PR 13, 14 | — | — |

## MIS

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| MIS-01 | Agenda Pessoal secreta | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-02 | Três missões ativas | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-03 | Reposição automática | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-04 | Missões com alvo humano nominal | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | Assinatura verificada por socket com três clientes. Testes integrados cobrem entrega de pizza e documento, transferência, visita e selfie, inclusive jogador errado com mesmo nome. HUD testado para os seis tipos. | — |
| MIS-05 | Missões de assinatura | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-06 | Missões de entrega de objetos | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-07 | Missões financeiras | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-08 | Missões de compra e consumo | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-09 | Missões de exploração | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-10 | Missões de fotografia | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-11 | Missões de decoração | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-12 | Missões de atividades ociosas | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-13 | Missões com duração | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-14 | Condições compostas e progresso parcial | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-15 | Missões condicionadas à visibilidade | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-16 | Seleção de objetivos realmente elegíveis | PARCIAL | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | Regras filtram participantes, mandatos e ciclos. Alvos isolados são substituídos em missões de contato. Sorteio verifica saldo para compras e pagamentos definidos, evita TV já comprada, exige mandato para protocolo e exclui selfie com cargo inexistente. Gabinete trancado permanece elegível via negociação ou arrombamento; teste exige entrada efetiva. Sorteio usa inventário e equipamento reais para alimentos e binóculo. Pizzada exige escândalo público antes do sorteio; teste cobre a mudança de elegibilidade. Missões de mobília verificam slots e orçamento no sorteio. Teste com compras reais cobre a redução do estoque, e o HUD exibe progresso de gastos em reais. Outros objetivos dependentes de disponibilidade no mapa seguem em revisão. | Média |
| MIS-17 | Evitar repetição imediata | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-18 | Recompensas em XP | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-19 | Recompensas econômicas e políticas | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-20 | Recompensas idempotentes | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-21 | Histórico das últimas conclusões | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-22 | HUD com duas concluídas e três ativas | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-23 | Checkboxes visuais e texto riscado | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-24 | Progresso parcial no HUD | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-25 | Privacidade das missões | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-26 | Substituição de objetivos inviáveis por saída do alvo | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-27 | Eventos de gameplay como fonte de conclusão | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-28 | Missões envolvendo NPCs | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-29 | Não permitir comprovação pública automática das missões alheias | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |
| MIS-30 | Catálogo único sem distinção formal de Caprichos | IMPLEMENTADO | PersonalAgenda.ts, photo-missions.ts, politics.ts, Documents.multiplayer.test.ts, hud.tsx; PR 12, 15 | — | — |

## COM

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| COM-01 | Correio Interno e comunicados globais | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-02 | Contraexposição usando comunicados | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-03 | VoIP por proximidade | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-04 | Propagação de áudio por salas e paredes | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-05 | Voz global durante Plenário | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-06 | Modulador de Voz | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-07 | Chamadas telefônicas privadas | PARCIAL | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | Convite e consentimento são privados; a fala local pode vazar por proximidade intencionalmente. Falta prova ponta a ponta com voz humana. | Média |
| COM-08 | Chamadas com áudio local de apenas um lado | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-09 | Indicação visual de jogador em chamada | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-10 | Megafone com transmissão global | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-11 | Filtro sonoro característico de megafone | PARCIAL | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | Filtro Web Audio verificado por sinal sintético em WebRTC. Falta teste de inteligibilidade com fala real. | Baixa |
| COM-12 | Composição entre Megafone e Modulador | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | Teste Chrome com sinal sintético confirmou áudio com Modulador e filtro de Megafone na mesma rota. | — |
| COM-13 | Exclusividade/cooldown de transmissões de megafone | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-14 | Anonimato no HUD do áudio global quando aplicável | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | Megafone oculta a indicação de quem fala inclusive perto de ouvintes. Socket verifica roteamento e teste do cliente cobre a regra da indicação. TV institucional identifica o locutor. | — |
| COM-15 | Publicações globais com custo e cooldown | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-16 | Texto curto e anexos | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-17 | Notificação global de novo comunicado | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-18 | Caixa de entrada durante a partida | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-19 | Snapshots imutáveis de anexos | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | InternalMail clona o artefato publicado. O teste com três clientes altera o original depois e confere o anexo. | — |
| COM-20 | Distinção entre comunicado e denúncia formal | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-21 | Publicações sem penalidade automática | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |
| COM-22 | Encaminhamento de documentos e laudos | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | Encaminhamento de comunicado público preserva o anexo e referencia o original. Laudos privados são entregues a quem fez a perícia, conforme o anexo. Testes React e socket. | — |
| COM-23 | Acordos verbais não garantidos pelo sistema | IMPLEMENTADO | voice.ts, SessionRoom.ts, InternalMail.ts, internal-mail.tsx, Documents.multiplayer.test.ts; PR 8, 13, 15 | — | — |

## DOC

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| DOC-01 | Documentos físicos vinculados a projetos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-02 | Adulteração documental | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | A Reprografia exige proximidade, um projeto diferente e cinco segundos; a operação cancela ao sair. | — |
| DOC-03 | Kit de Perícia e laudos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | Teste multiplayer cobre laudos verdadeiro e falso, consumo do kit e privacidade. Testes React conferem veredito e documento exibidos. | — |
| DOC-04 | Chantagem e blefe emergentes | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-05 | Emissão de documentos na Secretaria | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-06 | Identidade única por documento | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-07 | Transporte e transferência de documentos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-08 | Drop e coleta de documentos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-09 | Armazenamento em armários | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-10 | Assinaturas autoritativas | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-11 | Assinaturas vinculadas ao conteúdo original | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-12 | Signatários distintos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-13 | Inspeção visual de documento | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-14 | Projeto aparente separado do projeto verdadeiro | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-15 | Sala de Reprografia funcional | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-16 | Alteração aparente preservando assinaturas | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-17 | Falsificação sem validade institucional para novo projeto | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-18 | Documentos falsificados circulando no mundo | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-19 | Versionamento ou snapshots imutáveis | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | Comunicados e laudos preservam snapshots imutáveis. Testes de socket verificam que uma nova adulteração não altera o anexo anterior. | — |
| DOC-20 | Perícia de documento anexado a comunicado | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-21 | Laudo VERDADEIRO/FALSO | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-22 | Laudo recebido privadamente | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-23 | Laudo publicável como contraprova | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-24 | Laudo associado à versão exata | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-25 | Laudo não identifica automaticamente falsificador | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-26 | Proteção contra falsificação de laudos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-27 | Documentos falsos não alteram votos ou projetos | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |
| DOC-28 | Verificação formal na Secretaria/Protocolo | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | Secretaria e Protocolo oferecem verificação formal, com as mesmas regras usadas no protocolo. Testes de ação contextual e de resposta pelo socket. | — |
| DOC-29 | Documentos como anexos do Correio Interno | IMPLEMENTADO | Gameplay.ts, InternalMail.ts, project-picker.tsx, Documents.multiplayer.test.ts; PR 9, 15 | — | — |

## FOTO

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| FOTO-01 | Câmera fotográfica pelo celular | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-02 | Captura do mundo realmente visível | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-03 | Metadados autoritativos verificáveis | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-04 | Álbum de fotografias | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-05 | Mostrar fotografia para jogador próximo | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-06 | Compartilhar ou transferir cópia | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-07 | Vender fotografias e informações | PENDENTE | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | Compartilhamento de cópia existe; venda de evidência financeira é outro fluxo. Falta venda de fotos. | Média |
| FOTO-08 | Publicar fotografia no Correio Interno | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | Teste multiplayer cobre selfie anexada, recebimento por outro jogador e rejeição de foto alheia. Teste React cobre o canvas e a legenda. | — |
| FOTO-09 | Evidência de interações observáveis | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-10 | Fotos de dinheiro carregado | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-11 | Fotos de embolso e doação | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-12 | Fotos de decoração e ostentação | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-13 | Selfies | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-14 | Fotografias com jogador-alvo | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-15 | Captura remota por câmera escondida | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-16 | Captura remota por câmera institucional, se permitida | PENDENTE | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | Captura remota existe para câmera escondida. Falta rede institucional. | Média |
| FOTO-17 | Respeito ao fog of war | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-18 | Respeito ao anonimato e camuflagem | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-19 | Diferença entre evidência visual e interpretação do autor | IMPLEMENTADO | PhotoAlbum.ts, photography.ts, photo-renderer.ts, phone-photos.ts, photo-missions.test.ts; PR 9, 13, 15 | — | — |
| FOTO-20 | Integração com missões e Corregedoria | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Foto do álbum pode complementar denúncia se mostrar o acusado perto do local e horário da ocorrência. Fotos de missões mantêm o fluxo existente. | — |

## ESP

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| ESP-01 | Grampo de áudio clandestino | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-02 | Câmera escondida | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-03 | Instalação em móveis existentes | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-04 | Esconderijos compatíveis por tipo | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-05 | Um dispositivo por esconderijo | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-06 | Instalação sem alteração visual do objeto | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-07 | Interação canalizada de instalação | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-08 | Tentativa de instalação não revela dispositivo alheio | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-09 | Detector de escutas | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-10 | Inspeção de esconderijo com detector | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-11 | Descoberta não revela proprietário | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-12 | Escolha de manter dispositivo descoberto | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-13 | Remoção e desativação | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-14 | Central de Vigilância | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-15 | Lista de canais pessoais de áudio e vídeo | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-16 | Renomear canais | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-17 | Indicador de atividade por canal | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-18 | Alertas de som | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-19 | Alertas de movimento | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-20 | Monitoramento remoto de áudio | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-21 | Renderização remota do mundo por câmera | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-22 | Campo de visão e oclusão das câmeras | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-23 | Monitoramento de um canal por vez | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | Abrir câmera fecha grampo e vice-versa. Testes cobrem corte de áudio, encerramento de quadros e troca no painel. | — |
| ESP-24 | Captura fotográfica remota | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-25 | Limites de dispositivos por jogador | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-26 | Replicação seletiva de informações secretas | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-27 | Monitoramento sob demanda para preservar performance | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-28 | Câmeras institucionais do Congresso | PENDENTE | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | Falta rede institucional de câmeras. | Média |
| ESP-29 | Terminal presencial na Sala de Segurança | PENDENTE | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | Falta terminal físico público na Sala de Segurança. | Média |
| ESP-30 | Acesso público aos feeds institucionais | PENDENTE | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | Faltam feeds públicos institucionais. | Média |
| ESP-31 | Proibição de acesso remoto gratuito às câmeras públicas | PENDENTE | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | A regra depende da rede e do terminal institucional. | Média |
| ESP-32 | Câmeras públicas restritas a áreas comuns | PENDENTE | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | Falta catálogo institucional restrito a áreas comuns. | Média |
| ESP-33 | Sem identificação automática de autor da espionagem | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |
| ESP-34 | Possibilidade de transmitir informações falsas a espiões conhecidos | IMPLEMENTADO | Surveillance.ts, surveillance.ts, surveillance-viewport.ts, Gameplay.test.ts; PR 13, 15 | — | — |

## COR

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| COR-01 | NPC ou balcão da Corregedoria | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | — | — |
| COR-02 | Diálogo de atendimento | PENDENTE | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | Balcão abre ações diretamente. Falta diálogo de atendimento formal. | Média |
| COR-03 | Submissão de evidências | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Vítimas e testemunhas entregam ocorrência registrada e foto opcional no balcão. Validado por socket e HUD. | — |
| COR-04 | Verificação de infrações objetivas | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Agressão e roubos dependem de ocorrências autoritativas. Foto isolada não abre caso. | — |
| COR-05 | Recompensa ao denunciante quando cabível | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Denúncia confirmada paga até R$ 10 mil da reserva de recompensas. | — |
| COR-06 | Penalidade de popularidade ao denunciado quando comprovado | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Denúncia confirmada reduz popularidade em 8 e registra escândalo eleitoral. | — |
| COR-07 | Publicação oficial de escândalos | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Boletim oficial no Correio mostra a infração confirmada e o acusado. | — |
| COR-08 | Plantão da Vergonha | PENDENTE | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | Falta a apresentação e o fluxo do Plantão da Vergonha. | Média |
| COR-09 | Denúncias de agressão | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, internal-mail.test.tsx | Agressões registradas pelo combate podem ser denunciadas pela vítima ou testemunha. Fluxo confirmado por socket. | — |
| COR-10 | Denúncias de roubo | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, internal-mail.test.tsx | Roubo de carteira de NPC e roubo de cofre registram casos para vítima e testemunhas diretas. | — |
| COR-11 | Denúncias baseadas em fotografias | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, internal-mail.test.tsx | A foto do álbum pode complementar a ocorrência registrada. Testes rejeitam foto incompatível e denúncia sem ocorrência. | — |
| COR-12 | Histórico de denúncias | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, internal-mail.test.tsx | O Correio exibe as 24 decisões oficiais mais recentes da partida. | — |
| COR-13 | Prevenção de denúncias duplicadas | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Cada ocorrência é consumida uma vez; ações do mesmo tipo, autor e vítima são agrupadas por 10 s. | — |
| COR-14 | NPC se desloca fisicamente para denunciar | PENDENTE | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | Falta navegação autônoma de NPC para denúncia presencial. | Alta |
| COR-15 | Conhecimento limitado à percepção do denunciante | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | A denúncia exige vítima ou testemunha com visão direta registrada no momento da ocorrência. | — |
| COR-16 | Diferença entre denúncia oficial e comunicado público | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | — | — |
| COR-17 | Consequências eleitorais da perda de popularidade | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, InternalMail.ts, PlenaryMatch.test.ts; PR 8, 14, 15 | — | — |
| COR-18 | Denúncias não revelam facção secreta | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | O boletim publica somente ocorrência, acusado e indicação de foto. Facção permanece privada. | — |

## AFA

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| AFA-01 | Protocolo pago de pedido de afastamento | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-02 | Escolha de jogador acusado | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-03 | Inclusão do pedido na pauta | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-04 | Defesa do acusado | PENDENTE | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | A fase exibe o acusado e abre votação. Falta etapa de defesa dedicada. | Média |
| AFA-05 | Votação majoritária | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-06 | Afastamento temporário aprovado | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | Afastamento autoritativo de 60 s, com contador no HUD e retorno automático. Testes de regra e socket. | — |
| AFA-07 | Sala de isolamento | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | Sala física no mapa, com confinamento e retorno testados. | — |
| AFA-08 | Bloqueio de participação física/institucional durante afastamento | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | Sala exclusiva, previsão de movimento confinada e ações institucionais bloqueadas. Testes de cliente e gameserver. | — |
| AFA-09 | Retorno automático | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-10 | Preservação de patrimônio, gabinete e mandato | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-11 | Cooldown/imunidade contra afastamentos consecutivos | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | Novas audiências são permitidas. Quem retorna do isolamento tem 120 s de imunidade. Testes verificam o bloqueio e a liberação. | — |
| AFA-12 | Integração com sessões plenárias | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | A audiência leva os participantes ao Plenário. Afastados ficam na Sala de Isolamento e retornam à sessão se o prazo vencer durante a votação. | — |
| AFA-13 | Afastamento pode criar oportunidade de invadir gabinete | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | O acusado sai do gabinete compulsoriamente por 60 s. Portas e cofres conservam as regras de segurança existentes. | — |
| AFA-14 | Afastamento não reduz segurança de portas/cofres | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-15 | Afastamento não equivale à perda de mandato | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | — | — |
| AFA-16 | Proteção contra abuso e aprisionamento indefinido | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, PlenaryMatch.test.ts; PR 8, 14 | Temporizador autoritativo de 60 s, reconciliação descarta movimento pendente e a saída ocorre em ponto válido ou no Plenário. Novas audiências respeitam a imunidade individual. | — |

## CRI

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| CRI-01 | Estabilidade Institucional como barra principal | IMPLEMENTADO | PlenaryMatch.ts, plenary.ts, hud.tsx; PR 8, 14 | — | — |
| CRI-02 | Crises dinâmicas e espontâneas | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-03 | Incêndios | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-04 | Falhas elétricas/técnicas | PENDENTE | PlenaryMatch.ts, plenary.ts, hud.tsx; PR 8, 14 | Falta falha técnica dinâmica. | Alta |
| CRI-05 | Sabotagens deliberadas | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-06 | Perda gradual de Estabilidade durante crises | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-07 | Reparos e resolução presencial de crises | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-08 | Uso de extintores | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-09 | Projetos que reduzem frequência de crises | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-10 | Projetos que alteram recursos e riscos | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-11 | Pausa ou tratamento especial das crises durante Plenário | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-12 | HUD de origem e intensidade das perdas | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |
| CRI-13 | Relação entre déficit público e Estabilidade | IMPLEMENTADO | PlenaryMatch.ts, plenary.ts, hud.tsx; PR 8, 14 | — | — |
| CRI-14 | Efeitos públicos de projetos aprovados | IMPLEMENTADO | PlenaryMatch.ts, plenary.ts, hud.tsx; PR 8, 14 | — | — |
| CRI-15 | Infiltrados explorando crises e disputas políticas | IMPLEMENTADO | Fire.ts, fire.ts, Fire.test.ts, fire.test.ts, Documents.multiplayer.test.ts | Incêndio espontâneo ou provocado, extintor fixo no mapa, perda gradual e pausa no Plenário. Teto do Cafezinho aprovado adia novas ocorrências. | — |

## UI

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| UI-01 | HUD principal do jogo | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-02 | Estabilidade em destaque | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-03 | Orçamento Público | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-04 | Patrimônio pessoal | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-05 | Barras de PV e stamina | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-06 | Barra de XP e nível | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-07 | Agenda Pessoal no canto superior direito | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-08 | Backdrop semitransparente da agenda | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-09 | Inventário | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-10 | Equipamentos e slots | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-11 | Loja | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-12 | Diálogos | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-13 | Modais de confirmação | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-14 | Interface de atributos | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-15 | Modal de level up | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-16 | Interface de eleições | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-17 | Resultado de Renovação de Mandato | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-18 | Interfaces de cofre e stash | IMPLEMENTADO | office-stash.tsx, office-stash.test.tsx, match-hud.tsx, PrivateOffices.test.ts | Armário React mostra slots, segurança e atalhos para guardar e retirar. Cofre mostra progresso no mapa e no HUD, com cancelamento. Testes cobrem capacidade, acesso e custódia. | — |
| UI-19 | Interface de arrombamento | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-20 | Central de Vigilância | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-21 | Correio Interno | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-22 | Visualização de documentos | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-23 | Interface de falsificação | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-24 | Laudos de Perícia | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-25 | Indicadores de voz e chamadas | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-26 | Indicador de Megafone | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-27 | Notificações e toasts padronizados | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-28 | Responsividade e diferentes resoluções | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Há breakpoints e validação desktop em duas resoluções. Falta matriz completa de telas pequenas. | Média |
| UI-29 | Gerenciamento de foco e teclado | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-30 | Animações e microinterações | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-31 | SFX integrado às interfaces | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-32 | Design system consistente | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Paleta, barras e parte dos painéis são compartilhados. Ainda há estilos legados em paralelo. | Média |
| UI-33 | Tokens de cores, tipografia e espaçamento | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Tailwind centraliza parte dos tokens. Espaçamento e tipografia ainda se repetem em CSS legado. | Média |
| UI-34 | Biblioteca reutilizável de componentes | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Há componentes reutilizados de HUD e barras. Falta consolidar primitives para todos os modais e controles. | Média |
| UI-35 | React integrado ao Phaser | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-36 | Tailwind configurado | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-37 | Bridge tipada React ↔ Phaser | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Projeções tipadas e assinaturas seletivas existem. Parte dos comandos e painéis ainda é ligada em main.ts. | Média |
| UI-38 | Migração do HUD legado para React | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Núcleo do HUD está em React. Celular e partes do HUD fixo ainda usam DOM imperativo. | Média |
| UI-39 | Migração dos modais para React | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Atributos, campanha, loja, resultados e Correio usam React. Ainda há modais e hosts híbridos. | Média |
| UI-40 | Separação de estado de UI e gameplay | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-41 | Evitar rerenders React a cada frame | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-42 | Pointer events sem bloquear o canvas | IMPLEMENTADO | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | — | — |
| UI-43 | Remoção de interfaces legadas duplicadas | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Renderizações antigas foram removidas onde houve migração. Ainda há UI legada ativa. | Média |
| UI-44 | Validação visual automatizada/manual | PARCIAL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Há capturas e testes Chrome de partes do HUD. Falta cobertura visual recorrente dos fluxos complexos. | Média |
| UI-45 | Coerência com a direção artística existente | NÃO VERIFICÁVEL | main.ts, match-hud.tsx, hud.tsx, theme.css, progression-hud.tsx, rts-hud.css, vite.config.ts; PR 7, 10, 15 | Paleta e assets seguem convenções existentes. Coerência visual global exige revisão editorial. | — |

## D

| ID | Funcionalidade | Estado | Evidência | Observação | Complexidade |
|---|---|---|---|---|---|
| D-01 | Corrupção não identifica facção | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Economia e papéis usam estados separados. | — |
| D-02 | Economia com conservação de valor | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Reconciliação distingue emissão e expiração de circulação e gastos. Testes validam a conservação no roubo de cofre, descarte, coleta, resgate único, transferências, taxas e orçamento. | — |
| D-03 | Dinheiro físico precisa ser transportado | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Coleta transfere custódia; Tesouraria e cofre liquidam o valor. | — |
| D-04 | Patrimônio pessoal fica no cofre | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | O cofre representa o saldo do titular. | — |
| D-05 | Segurança presencial | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Ações de gabinete validam proximidade e presença do titular. | — |
| D-06 | Renovação de Mandato não é afastamento | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | A eleição elimina mandato; audiência suspende. | — |
| D-07 | NPCs não participam da Renovação | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | A eleição usa lista humana separada. | — |
| D-08 | Ex-parlamentar permanece no mapa | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | O estado former preserva movimentação e objetos. | — |
| D-09 | Missões são secretas | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Cada cliente recebe sua projeção privada. | — |
| D-10 | Não existe mais categoria formal de Caprichos | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Agenda usa um catálogo e um fluxo de conclusão. | — |
| D-11 | Assinatura verdadeira não garante documento verdadeiro | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Assinatura tem vínculo privado com o projeto assinado. | — |
| D-12 | Falsificação não cria apoio institucional válido | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Protocolo verifica o vínculo com as assinaturas. | — |
| D-13 | Publicação não equivale a prova | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Correio publica snapshots e não aplica penalidade por texto. | — |
| D-14 | Laudo comprova autenticidade, não autoria da falsificação | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Laudo contém versão e resultado, sem atribuir autoria. | — |
| D-15 | Equipamentos de espionagem geram informação limitada | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Espionagem replica canais e frames conforme acesso. | — |
| D-16 | Agressões furtivas exigem percepção legítima | IMPLEMENTADO | Complaints.ts, Complaints.test.ts, SessionRoom.test.ts, PlenaryMatch.test.ts, internal-mail.test.tsx | Testemunhas fora de visão, ausentes ou nocauteadas não recebem ocorrência de agressão. A vítima pode denunciar. | — |
| D-17 | O jogo deve permitir blefes | IMPLEMENTADO | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Missões privadas e documentos manipuláveis permitem blefe. | — |
| D-18 | Satirizar através do gameplay | NÃO VERIFICÁVEL | PlenaryMatch.ts, PoliticalEconomy.ts, Gameplay.ts, SessionRoom.ts, InternalMail.ts; PR 8, 12, 14, 15 | Há sátira em projetos, objetos e interações; qualidade é avaliação editorial. | — |
