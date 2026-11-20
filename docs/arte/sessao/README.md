# Direção de arte de Presidente da Sessão

Leitura obrigatória antes de gerar, editar, substituir, restaurar ou exportar
arte deste jogo. Os guias são a referência para novas entregas; a presença de
um arquivo no repositório, por si só, não o torna um exemplo aprovado.

## Escolha o guia pelo uso da imagem

| Uso | Guia |
| --- | --- |
| Corpo de personagem, NPC, animação ou transformação no mapa | [Personagens](personagens.md) |
| Objeto integrado ao cenário, móvel ou instalação | [Objetos do mapa](objetos-mapa.md) |
| Rosto/busto de personagem no HUD, seleção ou diálogo | [Portraits de personagens](portraits-personagens.md) |
| Produto na loja ou imagem de item no inventário/HUD | [Portraits de itens](portraits-itens.md) |

Leia todos os guias aplicáveis. Um objeto físico pode precisar de um sprite
para o mapa e de outro enquadramento para seu portrait de loja.

## Linguagem visual comum

- Ilustração raster pintada, caricata e com volume; acabamento consistente com
  as referências visuais nomeadas em cada guia.
- Contornos escuros desenhados, materiais reconhecíveis, sombras e reflexos
  modelando a forma; detalhes subordinados à leitura no tamanho de uso.
- Luz, paleta, perspectiva e nível de exagero acompanhando a família escolhida.
- Fundo com transparência real quando a imagem é recortada. O fundo verde,
  bordas, textos e destaques da interface são desenhados pelo jogo.
- SVGs e ícones geométricos servem à iconografia da interface. Não substituem
  a ilustração de personagens, objetos ou produtos do catálogo.

## Fluxo obrigatório

1. **Classifique o asset.** Leia os guias aplicáveis antes de escrever o prompt
   ou começar a desenhar. Identifique onde cada imagem será exibida.
2. **Abra referências visuais.** Inspecione pelo menos duas imagens da mesma
   categoria, incluindo uma do mesmo material, função ou família quando
   disponível. Use os masters existentes para observar acabamento; consulte
   o asset entregue para conferir escala e enquadramento. Anote os caminhos.
3. **Confira o contrato técnico.** Leia o loader, registro ou componente que
   consome a imagem. Registre formato, transparência, grade, ordem dos frames,
   dimensões, âncora e variantes exigidas. Um tamanho histórico não substitui
   essa leitura; não mude o contrato apenas para acomodar uma saída gerada.
4. **Gere com referências.** Use a ferramenta de imagem para arte raster nova;
   forneça as referências de estilo e, quando houver, de identidade/pose.
   Explique o papel de cada referência. O prompt deve incluir categoria,
   acabamento pintado, material, perspectiva, enquadramento, alpha e contrato
   técnico. Arquive o prompt e a origem do master junto à documentação de arte.
5. **Inspecione a imagem entregue.** Confira alpha sobre fundo claro, escuro e
   sobre o cenário/interface real. Amplie para procurar halos, recortes,
   fragmentos de células vizinhas e fundo ou preenchimento residual.
6. **Compare no contexto.** Veja a imagem ao lado de referências existentes,
   no tamanho real de uso. Para animações, assista ao ciclo nas direções
   exigidas; uma folha estática não comprova a caminhada. Confira também a
   ampliação usada pelo jogo, sem alterar câmera ou tamanho no mundo para
   esconder uma diferença de arte.
7. **Conclua com evidência.** Registre referências, prompt/master, arquivos
   entregues e captura da comparação no jogo. Só finalize quando todos os
   critérios do guia aplicável forem atendidos. Uma imagem fora do padrão
   deve ser refeita antes de ser apresentada como pronta.

## Separação entre arte e resolução

Exportar WebP, ter alpha e passar nos testes de dimensões não valida direção
de arte. Aumentar resolução também não corrige uma imagem de outra linguagem
visual. Preserve o master; gere os tamanhos de entrega a partir da mesma arte,
sem gerar identidades ou desenhos independentes para cada resolução.

Consulte os pipelines existentes antes de criar um exportador:

- [Elenco em alta resolução](../../../apps/sessao/dev/hires-cast/README.md).
- [Objetos, NPCs e interface em alta resolução](../../../apps/sessao/dev/hires-world/README.md).
- [Retratos de comida](../../../apps/sessao/food-portraits.md): referência de
  geração e recorte desse lote, não um tamanho universal para todos os itens.

## Limite das exceções

Uma transformação pode esconder a identidade do personagem por regra de jogo.
Ela continua respeitando proporções, movimento e integração com o elenco.
Isso não autoriza trocar seu portrait de loja por um ícone vetorial plano.
A imagem atual `capa-invisibilidade.webp`, derivada de um SVG simples, é um
exemplo de desvio a corrigir; não deve ser usada como referência de catálogo.
