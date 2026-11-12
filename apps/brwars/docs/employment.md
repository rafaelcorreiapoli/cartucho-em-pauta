# Trabalho e empregos

A Base oferece 6 vagas. Escola, hospital, universidade, banco e centro cultural concluídos oferecem 1 vaga cada somente enquanto estão em atividade; quartel, rádio, garagem e casas não oferecem empregos. Upgrades de prédios comuns não criam empregos extras.

Coop. do Povo (Esquerda) e Startup (Direita) custam R$ 300 e levam 18 segundos. Oferecem 12 vagas iniciais, +4 por nível adicional após concluir a melhoria. Seu único efeito econômico é oferecer empregos: não produzem renda sem trabalhadores, tropas ou popularidade.

Empregados = mínimo entre trabalhadores e vagas. Desempregados continuam consumindo população, mas não geram renda. Vagas desocupadas não geram renda. O crédito considera apenas trabalhadores empregados. Demolição remove vagas imediatamente; upgrades acrescentam vagas apenas ao concluir. Renda-base de R$ 8/s permanece.

O HUD mostra TRABALHO: trabalhadores / vagas; o popover detalha empregados, desempregados e vagas livres. A IA planeja vagas antes de contratar.

## Arte

Asset: `apps/web/public/assets/workplaces.png`, duas células de 768×1024, esquerda e direita. Referência visual: schools.png. Metadados de baseline derivados por `scripts/sprite-metadata.ts`, sem alterar a imagem.

Prompt: Generate a transparent PNG RTS building sprite atlas, exactly two equal 768x1024 cells side by side total1536x1024. Match reference painted chunky cartoon Brazilian RTS architecture: same thick dark outlines, simplified clean forms, cream trim, teal windows, 3/4 front view, ground baseline near82% of each cell, isolated actual alpha transparency no glow or backdrop. Left: satirical workers cooperative small workshop factory, red brick and red roof, large golden gear emblem over door, stacked wooden crates and two simple workbenches visible in open garage, small red flag. Right: satirical PJ employment firm small light industrial office workshop, green roof with golden trim, large golden briefcase emblem over door, loading crates, small green yellow flag. Both comparable size to reference school, whole building centered entirely inside own cell with generous margins. No people, no text, no letters, no watermark. Distinct from housing, school, hospital and military buildings.

## Desemprego e popularidade

Taxa de desemprego = trabalhadores sem vaga / total de trabalhadores (zero quando não há trabalhadores). Penalidade = −3 × taxa em POP/s: 10% = −0,3; 25% = −0,75; 50% = −1,5. Soma-se aos impostos e aos bônus culturais; a população militar e as vagas ociosas não entram no denominador. A recuperação de empregos remove a penalidade imediatamente, sem devolver popularidade já perdida.

A quantidade de vagas não altera a produtividade individual dos empregados. Ela limita quantos produzem; produtividade individual continua dependendo de pesquisa, impostos e estabilidade do governo. Exemplo: 10 trabalhadores / 6 vagas = 6 produzindo e 4 desempregados; a R$ 3/s por empregado, renda dos trabalhadores é R$ 18/s, além da renda-base.

## Custos de progressão

Fábricas de combate, moradias e locais de emprego evoluem de nível (até 15). Seus upgrades usam `160 × 1,65^(nível atual − 1)`, arredondado para a dezena mais próxima. Para fábricas, o crescimento cai de 1,65× para 1,22× por nível após o NV. 5 (N10→11 R$3.210, N14→15 R$7.100). Exemplos da curva de moradia e emprego: N1→2 R$160; N2→3 R$260; N3→4 R$440; N5→6 R$1.190; N10→11 R$14.500; N14→15 R$107.500. Pesquisas custam preço-base × 3^(nível pesquisado − 1): 1×, 3×, 9×. Tempos e efeitos são preservados.

A simulação, HUD e validação usam a mesma cotação. A demolição devolve metade do valor realmente investido, registrado por prédio; partidas antigas sem registro preservam o cálculo dos custos lineares anteriores, sem crédito retroativo pelo rebalanceamento.


## Vagas condicionadas à atividade

As 6 vagas iniciais da Base continuam permanentes, conforme escolha explícita. Startup/Coop. do Povo oferece 12 vagas depois da inauguração e +4 por nível adicional concluído. As vagas continuam disponíveis durante melhorias, sem antecipar o aumento do próximo nível.

Outros prédios só ativam sua capacidade de emprego quando há trabalho: escola/universidade com pesquisa naquele terreno; centro cultural com evento pago na fila; hospital com recuperação efetivamente iniciada e população reservada; fábricas com unidade já em produção. Pausar o modo automático não interrompe o pedido atual, portanto a atividade termina quando esse pedido acaba. Esperar recursos/população antes de iniciar não conta como atividade. Obras e upgrades isolados não contam.

No Banco, contratos de crédito ainda em cobrança ou aplicações em curso representam atividade. Apenas o banco pronto de maior nível (desempate pelo menor terreno) administra os contratos e oferece a vaga; construir bancos repetidos não duplica emprego a partir do mesmo contrato.

O fim da atividade remove vagas imediatamente do cálculo de emprego, renda, crédito e desemprego/POP/s. Recomeçar restaura as vagas. O catálogo mostra a capacidade potencial como “empregos durante atividade”; não há mudança nos valores de capacidade do rebalanceamento.
