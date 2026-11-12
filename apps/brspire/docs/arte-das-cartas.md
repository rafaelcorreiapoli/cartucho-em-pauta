# Arte das cartas do Cartas Marcadas

Use [Bolsa Família](../public/assets/card-bolsa-familia.webp) como referência para cenas com pessoas e [Petrolão](../public/assets/card-petrolao.webp) para a linguagem de sátira política e objetos exagerados. Anexe uma ou ambas as imagens à geração para manter o acabamento do conjunto.

## Nomes das cartas

Antes de propor uma carta, identifique a referência concreta que dá origem ao nome. Use um acontecimento, bordão, meme, jingle, personagem ou episódio reconhecível da política brasileira. Faça o efeito e a ilustração conversarem com essa referência. Se o nome servir igualmente para um jogo de fantasia genérico, refaça a proposta. Para cartas ligadas a um herói ou a uma facção, procure referências do universo deles.

## Direção visual

- Caricatura editorial brasileira em 2D, com contornos escuros marcados, pintura texturizada e expressões exageradas. Use luz quente, sombras profundas e contraste claro entre personagem e fundo.
- Conte a piada com uma ação e um objeto reconhecível. Dê prioridade ao rosto e ao objeto. Deixe o cenário em segundo plano.
- Gere em paisagem 3:2 e preencha a imagem até as bordas. Concentre os elementos essenciais nos 70% centrais da altura e deixe folga nos cantos para os indicadores da interface.
- Entregue só a ilustração. O jogo acrescenta moldura, custo, tipo e nome.

## Prompt base

> Ilustração 2D para uma carta do Cartas Marcadas. [Descreva quem aparece, a ação e o objeto que conta a piada.] Use as referências anexadas para reproduzir o acabamento de caricatura editorial brasileira, com contornos escuros, pintura texturizada, luz âmbar e sombras profundas. Composição em paisagem 3:2, preenchida até as bordas. Rosto e ação principal nos 70% centrais da altura. Sem texto, números, logotipos, marcas-d'água, moldura ou interface.

## Integração

Exporte em WebP para `public/assets/card-<nome>.webp` e use o nome sem extensão no campo `image` da carta em `src/catalog.ts`. Confira a leitura no tamanho de combate e em uma tela estreita. A área da arte usa `object-fit: cover` e a faixa de tipo ocupa parte da borda inferior.
