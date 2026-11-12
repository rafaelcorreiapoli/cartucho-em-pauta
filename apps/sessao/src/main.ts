import { Client, type Room } from '@colyseus/sdk';
import { createGame } from './game';
import { NAMES, type Player } from './map';
import './style.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const lobby = document.querySelector<HTMLFormElement>('#lobby')!;
const code = document.querySelector<HTMLInputElement>('#room-id')!;
const status = document.querySelector<HTMLElement>('#connection')!;
const session = document.querySelector<HTMLElement>('#session')!;
const map = document.querySelector<HTMLElement>('#map')!;
const create = document.querySelector<HTMLButtonElement>('#create')!;
const invite = document.querySelector<HTMLButtonElement>('#invite')!;
const leave = document.querySelector<HTMLButtonElement>('#leave')!;
const characters = document.querySelector<HTMLElement>('#characters')!;
const buttons = NAMES.map((name,index) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.type = 'button';
  button.setAttribute('aria-pressed','false');
  button.onclick = () => {
    room?.send('character',index);
    map.focus({preventScroll:true});
  };
  characters.append(button);
  return button;
});
let room: Room | undefined;
let game: ReturnType<typeof createGame> | undefined;
code.value = new URL(location.href).searchParams.get('sala') || '';

function showLobby(message: string) {
  game?.destroy();
  game = undefined;
  room = undefined;
  session.hidden = true;
  lobby.hidden = false;
  status.textContent = message;
}

async function connect(join: () => Promise<Room>) {
  if (room || create.disabled) return;
  create.disabled = true;
  status.textContent = 'Conectando…';
  try {
    const joined = await join();
    room = joined;
    code.value = joined.roomId;
    lobby.hidden = true;
    session.hidden = false;
    status.textContent = `Sala ${joined.roomId}`;
    game = createGame(map,joined.sessionId,motion => joined.send('move',motion));
    joined.onMessage('players',(players: Player[]) => {
      game?.update(players);
      const self = players.find(player => player.id===joined.sessionId);
      const label = `Sala ${joined.roomId} · ${players.length}/6 jogadores`;
      if (status.textContent!==label) status.textContent = label;
      buttons.forEach((button,index) => button.setAttribute('aria-pressed',String(index===self?.character)));
    });
    joined.onLeave(() => {
      if (room===joined) showLobby('Você saiu da sala.');
    });
    map.focus({preventScroll:true});
  } catch {
    showLobby('Não foi possível conectar. Confira o código e se o servidor está rodando.');
  } finally {
    create.disabled = false;
  }
}

create.onclick = () => void connect(() => client.create('plenary'));
lobby.onsubmit = event => {
  event.preventDefault();
  const roomId = code.value.trim();
  if (roomId) void connect(() => client.joinById(roomId));
};
leave.onclick = () => void room?.leave();
invite.onclick = async () => {
  if (!room) return;
  const url = new URL(location.href);
  url.searchParams.set('sala',room.roomId);
  try {
    await navigator.clipboard.writeText(url.href);
    invite.textContent = 'Link copiado';
    setTimeout(() => { invite.textContent = 'Copiar link'; },1500);
  } catch {
    window.prompt('Link da sala',url.href);
  }
};
