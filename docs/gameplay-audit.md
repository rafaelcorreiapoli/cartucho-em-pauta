# Auditoria do Infiltrados no Congresso

A classificação cobre a branch `codex/sessao-raiox` no commit `b14ea6b`, que inclui código do [PR #15 aberto](https://github.com/rafaelcorreiapoli/cartucho-em-pauta/pull/15). A produção não foi usada como referência. A tabela canônica preserva os IDs do inventário e inclui as 18 regras de design. [Backlog](gameplay-backlog.md).

## Integrações verificadas

| Fluxo | Evidência | Limite |
|---|---|---|
| Dinheiro físico, cofre e Tesouraria | PrivateOffices.test.ts cobre custódia, saque, titular nocauteado e resgate único. ElectionCycle.test.ts cobre folha debitada do Orçamento e pagamento proporcional. | Os testes cobrem as etapas em conjunto, sem uma partida gravada do início ao fim. |
| Campanha, Renovação e perda de mandato | ElectionCycle.test.ts verifica folha, perda de um mandato e vitória após perda de mandato dos infiltrados. | A campanha e o resultado têm interface; ainda existe código legado dos cargos. |
| Negociação, voto comprado e roubo de NPC | Parliamentarians.test.ts cobre ofertas concorrentes, compromisso preservado e roubo com objeto físico. | Falta o ciclo social de memória, fuga, retaliação e denúncia. |
| Dispositivos, observação e evidência | Gameplay.test.ts cobre concorrência na instalação, propriedade, reconexão, áudio e foto. O feed de câmera usa viewport Phaser. | A rede institucional e seu terminal presencial estão pendentes. |
| Emissão, assinatura, falsificação, publicação, perícia e contraexposição | Documents.multiplayer.test.ts conecta três clientes à sala e verifica laudo privado, anexo imutável e assinatura do alvo correto. | Foto anexada, laudo verdadeiro e demais missões com alvo carecem de cobertura equivalente ponta a ponta. |
| Missão, XP, nível e atributos | PersonalAgenda.test.ts, CharacterProgression.test.ts e SessionRoom.test.ts cobrem progressão e comandos autoritativos. | A cobertura visual dos modais e a elegibilidade de cada missão contextual ainda são incompletas. |

## Divergências e transições

- **Emissão monetária.** O spawn escolhe entre maletas e maços em Gameplay.ts. A descrição de emissão recorrente exclusiva por maleta diverge do comportamento.
- **Nocaute.** Combat.ts define recuperação de oito segundos e quatro segundos de proteção. O transporte termina na recuperação normal. A duração sugerida de 15 segundos e sua extensão durante transporte continuam no backlog.
- **Afastamento.** PlenaryMatch.ts abre audiência e PoliticalEconomy.ts suspende permissões e limpa a suspensão. O modelo atual não cria confinamento, defesa dedicada ou janela física de invasão.
- **Eleições.** A Renovação usa uma disputa única entre humanos. Cargos antigos ainda têm definições no domínio. NPCs não entram nessa disputa.
- **Mapa.** A Corregedoria reaproveita a antiga Controladoria. A Reprografia substituiu a Galeria. A Loja é o balcão do Apoio Técnico, e Cantina corresponde à Lanchonete. Banheiros, Salão Verde, Sala das Lideranças, Sala de Segurança e isolamento não aparecem como salas funcionais no catálogo de mapa atual.
- **HUD.** React e Tailwind renderizam parcelas do HUD e modais. Celular, controles fixos e alguns hosts ainda convivem com DOM imperativo. A separação entre renderização e regras de gameplay já existe nos fluxos migrados.
- **Documentos.** Os modelos legados continuam disponíveis pelo protocolo de emissão para compatibilidade. Documentos de projetos e laudos seguem o fluxo mais recente.

## UI sem gameplay e backend sem UI

A inspeção não identificou uma interface de crise, isolamento ou câmera institucional que deva ser tratada como implementação desses sistemas. A auditoria e a publicação de evidências funcionam, porém os painéis atuais não oferecem um fluxo completo de denúncia formal com dossiê e fotografia. O catálogo vende o Kit de Perícia funcional usando o retrato do documento.

O servidor mantém metadados de assinatura e o original de documentos adulterados. O jogador vê a versão circulante e, quando autorizado, o laudo. A ausência de consulta pública do histórico é coerente com o blefe. Logs contábeis estruturados existem sem painel de observabilidade para a equipe.

## Próximas cinco prioridades

1. Fechar os testes de documentos, fotos e todos os alvos da Agenda. Usa os fluxos existentes e cobre as fronteiras de privacidade e idempotência antes de expandir denúncias.
2. Implementar a denúncia formal na Corregedoria. Reutiliza auditoria, evidências, fotos e popularidade. O risco principal é confundir acusação pública com infração comprovada.
3. Integrar memória, percepção e denúncia de NPCs. Depende da Corregedoria e acrescenta consequência à negociação e ao combate.
4. Completar o afastamento temporário. A audiência existente reduz o escopo, mas isolamento, retorno e bloqueio de ações precisam de testes de reconexão.
5. Introduzir uma primeira crise presencial completa. Começar por uma fonte, um reparo e feedback de estabilidade. Integrar efeitos de projetos depois de testar concorrência e transição de fase.

A auditoria combina inspeção de código, histórico Git e estado dos PRs com testes do projeto. Classificação estática não substitui uma rodada manual para balanceamento, coerência artística, inteligibilidade de voz ou situações dependentes da rede.

### Retratos de itens

Use os retratos do binóculo e do Raio X como referências de estilo para novas artes. Exporte o objeto isolado em WebP quadrado de 256 × 256, com transparência e margem livre. Confira a silhueta no tamanho do slot do inventário e o recorte no cartão da loja. Registre o nome do arquivo no catálogo em `apps/sessao/src/gameplay.ts` ou na definição de origem do item. Retratos existentes também usam 192 × 192 e alguns itens reutilizam sprites retangulares.

O teste em `gameplay.test.ts` verifica nome, existência e cabeçalho WebP de todos os retratos do catálogo. A revisão do tamanho, da transparência e da direção artística continua visual.
