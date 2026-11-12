# Edifícios, hospital e Banco

Barracks, media e garage têm níveis de prédio: Sindicato/Escritório, Rádio/Central do Zap, Garagem. Cada nível continua fortalecendo a unidade produzida. Pesquisa individual mantém seus próprios três níveis, independentemente do prédio.

Moradias oferecem 6 de população, +2 por nível adicional; Startup/Coop. oferece 12 empregos, +4 por nível adicional. Ambas evoluem até o nível 15, com custo exponencial e benefício aplicado após concluir a melhoria. Escolas, universidade, hospitais, centro cultural e Banco não evoluem de nível. A ampliação de capacidade pode usar novos edifícios ou melhorias de moradias e locais de emprego. O servidor recusa upgrades nesses tipos sem cobrar; HUD, hotkeys e controle no mapa seguem a mesma regra. A melhoria da arma da Base é uma ação específica e permanece disponível.

## Hospital

Médico Cubano / Médico do Convênio custam R$220, ocupam 2 de população e levam 10s antes dos modificadores de treinamento. Cada hospital pronto tem fila manual própria de até 5 médicos. Reserva população ao iniciar cada pedido; aguarda se não há vagas. Não usa a fila da Base. O nível do médico é sempre 1; pesquisas globais ainda se aplicam normalmente.

Hospital em recuperação de herói pode receber pedidos de médico, mas só inicia a produção quando a recuperação acaba. Não inicia recuperação de herói se já há médicos na fila. Demolição cancela pedidos e libera reservas; não reembolsa tropas. A fila ativa concede o emprego marginal do hospital, mostra portrait, fila e progresso no HUD e uma barra amarela no mapa. Codec Colyseus sincroniza a fila própria e o valor investido dos prédios.

## Escala financeira sem níveis

Renda sustentável = R$8/s + empregados × R$3/s × bônus de produtividade pesquisado. Impostos, caixa e popularidade não inflacionam esse indicador. Limite de crédito = 40 segundos dessa renda.

Escala das ofertas = máximo entre 1 e a parte inteira de (renda sustentável / 25). Cada produto mantém seu prazo e taxa, multiplicando o principal por essa escala. Crédito continua incluindo ajuste de juros por exposição ao limite existente. Aplicações usam valores sugeridos pela economia, conforme escolha do usuário; limite de 6 contratos de cada tipo permanece.

Exemplo com 30 empregados sem pesquisa: renda sustentável R$98/s, limite R$3.920 e escala 3. Ponte oferece R$600, Capital de giro R$900, Expansão R$1.800; aplicações Reserva R$450, Renda fixa R$900 e Longo prazo R$1.800. A cotação usada pelo HUD é a mesma validada pelo servidor. Crescimento posterior não reprecifica contratos existentes.
