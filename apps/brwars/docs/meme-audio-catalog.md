# Memes e falas de personagens

Pesquisa em Myinstants em 06/11/2026. Os títulos abaixo são os nomes dos uploads do site, não afirmações do jogo sobre as pessoas citadas. O catálogo registra fontes; os arquivos integrados estão listados abaixo e tocam em cada entrada em campo, inclusive revives.

| Título no site | Página para ouvir / baixar |
|---|---|
| Lula o maior presidente da história do Brasil | https://www.myinstants.com/pt/instant/lula-o-maior-presidente-da-historia-do-brasil-57126/ |
| Pergunta pro google | https://www.myinstants.com/pt/instant/pergunta-pro-google-91057/ |
| Lula - É pra apanhar e ficar calado | https://www.myinstants.com/pt/instant/lula-e-pra-apanhar-e-ficar-calado-98499/ |
| Aí cruzou a linha - Mamãe Falei | https://www.myinstants.com/pt/instant/ai-cruzou-a-linha-mamae-falei-34190/ |
| Bolsonaro Risada | https://www.myinstants.com/pt/instant/bolsonaro-risada-16534/ |
| Bolsonaro pegaram meu telefone | https://www.myinstants.com/pt/instant/bolsonaro-pegaram-meu-telefone-55053/ |
| Dilma dobra meta | https://www.myinstants.com/pt/instant/dilma-dobra-meta-33908/ |
| WRONG! - Donald Trump | https://www.myinstants.com/pt/instant/wrong-donald-trump-33829/ |
| Donald Trump: Build a wall | https://www.myinstants.com/pt/instant/donald-trump-build-a-wall/ |

## Arquivo integrado

- Local: `apps/web/public/audio/lula-entry.mp3`.
- URL original: https://www.myinstants.com/media/sounds/lula-vai-todo-mindo-se-fdr.mp3
- Upload atual: `yan258`, página https://www.myinstants.com/pt/instant/lula-vai-todo-mindo-se-fdr-5266/. Substitui a fala anterior.
- MP3 estéreo, 44,1 kHz, 128 kbps, cerca de 5,07 segundos, inteiro. Normalização −18 LUFS, pico −2 dB, fade de saída de 50ms; sem síntese ou alteração da voz.
- Evento `lulaEntry`: cada entrada confirmada em campo do herói `lulinha`, inclusive após recuperação no Hospital. Somente o próprio jogador ouve. Não toca ao enfileirar, em pedidos rejeitados, snapshots repetidos ou ao reconectar com um herói já vivo. A contagem de recuperações distingue cada nova entrada.
- Usa mixer de SFX, volume, mute, limitação de vozes e política de gesto do browser existentes. Ganho do evento: 0,55. Não é carregado enquanto o evento não ocorre.
- Procedência: upload comunitário do Myinstants. Não está incluído na declaração CC0 dos efeitos anteriores; a página não informa uma licença específica para esse upload.


## Novas entradas de heróis

| Herói | Arquivo local | Duração aproximada | Fonte solicitada |
| --- | --- | --- | --- |
| Trump | `trump-entry.mp3` | 3,74s (inteiro) | https://www.myinstants.com/pt/instant/trump-quote-about-minors-2723/ |
| Bolsonaro | `bolsonaro-entry.mp3` | 4s (inteiro) | https://www.myinstants.com/pt/instant/bolsonaro-vc-tem-uma-cara-de-homossexual-terriv-41771/ |
| Che Guevara | `che-entry.mp3` | 8,5s (início do trecho musical, fade de 350ms) | https://www.myinstants.com/pt/instant/comandante-che-guevara-23756/ |
| Mamãefalei | `mamaefalei-entry.mp3` | 5,95s (inteiro) | https://www.myinstants.com/pt/instant/mamae-falei-16385/ |
| Pablo Marçal | `marcal-entry.mp3` | 6,53s (inteiro) | https://www.myinstants.com/pt/instant/datena-cadeirada-60119/ |

Todos em `apps/web/public/audio/`. Originais: `https://www.myinstants.com/media/sounds/` com nomes `trump-quote-about-minors.mp3`, `bolsonaro-vc-tem-uma-cara-de-homossexual-terriv.mp3`, `comandante-che-guevara.mp3`, `mamae-falei.mp3`, `datena-cadeirada.mp3`.

Normalização FFmpeg para −18 LUFS / pico −2 dB, estéreo 44,1 kHz 128 kbps; fades curtos de saída, sem alteração de voz ou pitch. Trechos já menores que 10s preservados inteiros; Che limitado a 8,5s. Eventos próprios `trumpEntry`, `bolsonaroEntry`, `cheEntry`, `mamaefaleiEntry`, `marcalEntry`, ganho 0,55 no mixer de SFX existente. Mesmo rastreador de deployments do Lula: não toca no recrutamento, snapshot repetido ou reconexão com herói já vivo. Somente o jogador dono ouve a fala. Fonte comunitária, separada da licença CC0 dos SFX originais.


## Jones Manoel, Stalin e morte de herói

- Jones: https://www.myinstants.com/pt/instant/jones-manoel-53946/ → `https://www.myinstants.com/media/sounds/jones-manoel.mp3` → `jones-entry.mp3`. Trecho inicial de 9,58s encerrado na pausa identificada após a primeira frase, antes da frase seguinte; original 13,54s. Fade de 50ms.
- Stalin: https://www.myinstants.com/pt/instant/comunismo-30581/ → `https://www.myinstants.com/media/sounds/russiananthem_HpYdMqi.mp3` → `stalin-entry.mp3`. Trecho musical inicial de 8,5s, original 13,06s, fade de 250ms.
- Mesmos formato, normalização, mixer e eventos de deployment dos outros heróis, agora `jonesEntry` e `stalinEntry`.
- `hero-death.mp3`: efeito instrumental procedural original de 3,7s, acorde menor grave (98 / 116,54 / 146,83 / 196Hz), impacto descendente e reverberação. Produzido localmente com FFmpeg `aevalsrc`, filtro passa-baixa 1800Hz, ecos em 130/290/470ms, normalização −18 LUFS / pico −2dB e fade final. Sem voz ou sample externo. Evento `heroDeath` para heróis aliados e inimigos ao transitar de vivo para morto; snapshots repetidos, reconexão e cancelamento de recuperação não repetem o som. Segue volume/mute de SFX existente, sem alterar pitch.
