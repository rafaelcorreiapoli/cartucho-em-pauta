# Objetos do mapa

Leia também o [fluxo obrigatório](README.md). Aplica-se a móveis, instalações,
equipamentos físicos e objetos desenhados no cenário. A imagem de venda do
mesmo objeto segue também o [guia de portraits de itens](portraits-itens.md).

## Referências visuais

Caminhos a partir da raiz do repositório:

- `apps/sessao/public/assets/gabinete-cofre.webp` e
  `gabinete-cofre-aberto.webp`: pintura, materiais e estados do mesmo objeto.
- `apps/sessao/public/assets/gabinete-poltrona.webp`: volume e integração de móvel.
- `apps/sessao/public/assets/terminal-seguranca.webp`: equipamento instalado.
- Masters correspondentes em `apps/sessao/dev/hires-world/masters/`.

Escolha as referências mais próximas da implantação: um objeto de parede,
um móvel de piso e um item largado têm enquadramentos e âncoras diferentes.

## Direção de arte

- Objeto ilustrado com volume, contorno escuro e materiais pintados compatíveis
  com os móveis e equipamentos existentes: metal, madeira, couro ou vidro.
- Perspectiva e iluminação acompanham os objetos vizinhos no ambiente.
  Preserve a vista frontal elevada ou em três quartos da família selecionada;
  não imponha isometria ou uma câmera de fotografia de produto ao mapa.
- Apoio, sombra de contato e profundidade fazem o objeto pertencer ao cenário.
  Confira se a sombra já é desenhada pelo código antes de incluí-la na imagem.
- Desenhe apenas a peça necessária. Parede, piso, placa, personagem ou objeto
  vizinho que já pertencem ao mapa ficam fora do sprite.
- Estados aberto/fechado, ligado/desligado ou íntegro/danificado compartilham
  escala, câmera, iluminação e âncora; a mudança comunica o estado da peça.

## Integração

- Confira o carregamento/desenho em `apps/sessao/src/world-art.ts`,
  `draw-map.ts`, `map-props.ts` e a definição específica do objeto, como
  `private-offices.ts` ou `installations.ts`.
- Preserve dimensões no mundo, origem, ponto de apoio, posição de interação e
  colisão. Margem transparente extra não pode deslocar a peça visível.
- Objetos retangulares preservam sua proporção; não estique para preencher
  uma célula quadrada. Siga a grade real de atlas quando houver.
- Confira o [pipeline de objetos e interface](../../../apps/sessao/dev/hires-world/README.md)
  antes de criar variantes de resolução.

## Critérios de conclusão

- Captura no local real, ao lado de móveis/personagens, confirma escala,
  perspectiva, luz e contato com chão ou parede.
- Frente/atrás de personagens e peças próximas respeitam a profundidade esperada.
- Área de interação e barreiras continuam alinhadas com a parte visível.
- Todos os estados usados pelo jogo foram vistos, sem salto de posição ou tamanho.
- Alpha não produz retângulo, halo claro ou sombra duplicada sobre o cenário.
