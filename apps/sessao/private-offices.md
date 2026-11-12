# Gabinetes particulares

A partida comporta seis jogadores. O servidor sorteia um gabinete por jogador e o
posiciona lá no início da sessão. A atribuição não depende de cargo ou de papel
secreto e é preservada na reconexão. Os seis cômodos compartilham dimensões,
soleira, pontos de interação e sprites. Paredes existentes servem de divisória
onde o cômodo encosta no prédio.

- **Cofre:** maletas, cuecas e maços viram saldo após cinco segundos de interação
  no cofre próprio. Mover-se, ser nocauteado ou entrar no Plenário interrompe a
  operação. O item só é consumido quando o dinheiro é creditado.
- **Armário:** guarda até quatro instâncias do inventário, incluindo dinheiro
  físico. Só o titular ou quem chega a um armário temporariamente arrombado
  pode ver seu conteúdo, guardar ou retirar itens.
- **Segurança:** porta e armário têm níveis independentes de 1 a 5. Ferramentas
  têm nível de ataque e são consumidas no sucesso; a abertura dura 30 segundos.
  Um visitante preso por uma porta trancada pode sair pelo lado de dentro.
- **Decoração:** TV, tapete, poltrona e retrato são instalados em pontos fixos.
  Os móveis usam sprites próprios no mapa, separados dos retratos do catálogo.
- **Exposição:** dinheiro físico coletado fica exposto; outros itens podem ser
  mostrados individualmente. O jogo e a câmera exibem apenas os itens expostos
  de personagens visíveis. Guardar ou largar um deles não esconde os demais.

As regras de propriedade, alcance, pagamento e cancelamento são validadas no
servidor. A mesma geometria de portas alimenta colisões, rotas e visibilidade.
