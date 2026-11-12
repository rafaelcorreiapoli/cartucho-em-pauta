# HUD compartilhado

Importe `styles.css` para usar a paleta e os elementos visuais inspirados em Cartas Marcadas. As classes funcionam em HTML ou JSX.

- `hud-panel`, `hud-strip` e `hud-title` dão estilo à superfície e ao título. O jogo decide a posição, o tamanho e se usa uma seção ou um diálogo.
- `hud-button`, `hud-button--secondary`, `hud-icon-button`, `hud-option` e `hud-range` estilizam controles nativos. O jogo fornece os rótulos e liga cada controle à ação correspondente.
- `hud-loading`, `hud-loading-content`, `hud-loading-title`, `hud-progress` e `hud-progress-value` compõem a tela de carregamento. Use um elemento `progress` com rótulo acessível. O jogo informa o progresso e decide quando liberar a partida ou oferecer uma nova tentativa.

`createAudioPreferences` recebe os volumes padrão e uma chave de armazenamento ou um adaptador `read` / `write`. O módulo normaliza os volumes, guarda as alterações e notifica quem está inscrito. Use `effectiveVolume` para aplicar o volume de um canal considerando o estado de mudo. Os arquivos, eventos e reprodução continuam no jogo.
