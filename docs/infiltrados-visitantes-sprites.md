# Sprites dos visitantes do Infiltrados

Elenco inicial: Nestor Cerveró, Pablo Marçal, Joesley Batista, Marcos Valério,
Marcelo Odebrecht, João Santana, Alexandre de Moraes e Delcídio do Amaral.

As folhas ficam em `apps/sessao/public/assets/` e seguem o padrão do elenco:
512 × 384 pixels, quatro colunas e três linhas, com frames de 128 × 128.
As linhas mostram frente, perfil direito e costas. Para olhar à esquerda,
o renderizador deve espelhar o perfil direito.

| Personagem | Prefixo dos arquivos | Origem |
| --- | --- | --- |
| Nestor Cerveró | `nestor-cervero` | Caminhada, hit e queda existentes, preservados sem alteração. |
| Pablo Marçal | `pablo-marcal` | Identidade reaproveitada de `apps/brwars/apps/web/public/assets/hero-marcal.png`, adaptada à grade e às direções do Infiltrados; rosto refeito com acabamento realista, sem cadeira. |
| Joesley Batista | `joesley-batista` | Novo. |
| Marcos Valério | `marcos-valerio` | Novo. |
| Marcelo Odebrecht | `marcelo-odebrecht` | Novo. |
| João Santana | `joao-santana` | Novo. |
| Alexandre de Moraes | `alexandre-de-moraes` | Novo. |
| Delcídio do Amaral | `delcidio-do-amaral` | Novo. |

Cada prefixo tem três folhas com fundo transparente:

- `-walk.png`: ciclo de caminhada, quatro frames por direção.
- `-hit.webp`: reação ao golpe e retorno à postura inicial, quatro frames.
- `-fall.webp`: queda até o nocaute, quatro frames; manter o último enquanto estiver caído.

As referências de geração foram `nestor-cervero-walk.png`, `bolsonaro-hit.webp`
e `bolsonaro-fall.webp`. As folhas novas de hit e queda também usaram a
caminhada do respectivo personagem para manter a identidade visual.
As folhas WebP novas usam compressão sem perdas.

Para revisar as animações, rode `bun run dev` em `apps/sessao` e abra
`/dev/visitor-sprites.html`. O visor mostra as três ações e permite alternar
frente, lado e costas ou pausar os ciclos.

Esta entrega prepara a arte. A ligação com o spawn periódico, os valores de
saque e a retirada das negociações e votos dos NPCs será feita na integração
da mecânica de visitantes.

## Geração

Ferramenta: ImageGen integrada, com as folhas existentes como referências
explícitas de estilo e de poses. Não foi usado o CLI de geração.

Conjunto de prompts:

1. Substituir a identidade do personagem da folha de caminhada pelo visitante,
   mantendo caricatura pintada, proporções, perspectiva, iluminação, quatro
   frames e três direções da referência. Fundo transparente, sem objetos.
2. Usar a caminhada aprovada como referência de identidade e as folhas de hit
   e queda do elenco como referência de animação. Preservar rosto, cabelo e roupa.
3. Corrigir o alinhamento das quedas: manter o corpo deitado inteiro dentro da
   quarta célula, com margem transparente, usando a queda do Nestor como guia.

As dimensões finais foram normalizadas para a grade do jogo. O Nestor não
foi regenerado; no Pablo, foi reaproveitada a identidade da arte existente.
