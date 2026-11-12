# Nomes dos prédios

Os nomes são os rótulos de uma sátira ficcional. Tipos internos, requisitos, custos, efeitos e atalhos permanecem os mesmos.

| Tipo | Esquerda | Direita |
|---|---|---|
| Infantaria | Sindicato | Escritório |
| Ataque à distância | Rádio do Sindicato | Central do Zap |
| Cerco | Garagem do Sindicato | Garagem da Havan |
| Popularidade | Sarau da Rouanet | Arena XP |
| Moradia | Ocupação MST | Studio Faria Lima |
| Banco | Caixa do Povo | Banco do Primo Rico |
| Universidade | Federal Sucateada | INSPER |
| Escola | Escolinha Paulo Freire | Colégio do Mérito |
| Hospital | Postinho do SUS | Hospital Particular |

O segundo exemplo de faculdade na conversa foi interpretado como referente à Esquerda. A fonte dos nomes em runtime é `FACTIONS[side].buildings` em `packages/simulation/src/content.ts`.

## Atalhos

Quando a letra aparece no nome, ela é realçada em amarelo/negrito. Quando não aparece, o rótulo é `Nome [tecla]`, mantendo a tecla amarela. O sufixo não desaparece se um nome longo precisar de reticências. Não há troca automática dos atalhos por causa de renomeações; os atalhos de magias continuam 1–4.

A referência de Arena XP aparece em publicação da própria XP: https://conteudos.xpi.com.br/renda-fixa/relatorios/arena-xp-credito-privado-em-2026-com-fitch-ratings/

## Catálogos de pesquisa

Obras aceleradas pertence à escola. Treino à distância (artilharia) e Engenharia de cerco pertencem à universidade. Os dois lados compartilham essa distribuição.

## Portraits distintos

`research-category-portraits.png` contém três células quadradas: ferramentas e manual técnico para Formação profissional, estandarte com capacetes para a categoria Exército e balança com moedas e mercadorias para Econômico. `research-construction.png` mostra capacete, alvenaria, colher de pedreiro e ampulheta para Obras aceleradas, distinguindo-a de Engenharia estrutural.

Prompts usados: atlas de três células em uma linha, pintura de RTS cômico, contornos escuros, destaques dourados e fundo verde oliva; ferramentas sobre manual técnico sem símbolos médicos; capacetes em torno de estandarte militar sem espadas cruzadas; balança equilibrando moedas e caixa comercial. Para Obras aceleradas: portrait quadrado com capacete amarelo, parede em construção, colher de pedreiro, ampulheta dourada e rastros de velocidade, sem texto.
