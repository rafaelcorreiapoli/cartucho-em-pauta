import {useRef,type Ref} from 'react';
import {createRoot} from 'react-dom/client';
import {NICK_LIMIT,nickHint,readNick} from '../nick';

type Props = {
  initialNick:string;
  invited?:boolean;
  roomCode:string;
  busy:boolean;
  message:string;
  onConnect:(nick:string,roomCode?:string,tutorial?:boolean)=>void;
  nickRef:Ref<HTMLInputElement>;
};

export function RoomEntrance({initialNick,roomCode,busy,message,onConnect,nickRef,invited=false}:Props) {
  const form = useRef<HTMLFormElement>(null);

  function submit(join:boolean,tutorial=false) {
    if (busy || !form.current) return;
    const nickInput = form.current.elements.namedItem('nick') as HTMLInputElement;
    const codeInput = form.current.elements.namedItem('room-id') as HTMLInputElement;
    const nick = readNick(nickInput.value);
    const code = codeInput.value.trim();
    nickInput.setCustomValidity(nick ? '' : nickHint);
    if (!nickInput.reportValidity() || !nick || (join && !code)) return;
    nickInput.value = nick;
    onConnect(nick,join ? code : undefined,tutorial);
  }

  return <>
    <h1 className="lobby-brand"><img src={import.meta.env.BASE_URL+'assets/logo-infiltrados.webp'} alt="Infiltrados no Congresso"/></h1>
    <form id="lobby" ref={form} onSubmit={event=>{event.preventDefault(); submit(true);}}>
      <label className="nick-field">Seu nick <input id="nick" name="nick" ref={nickRef} maxLength={NICK_LIMIT}
        autoComplete="nickname" placeholder="Como vão chamar você?" defaultValue={initialNick} required
        onInput={event=>event.currentTarget.setCustomValidity('')}/></label>
      {!invited && <><button className="hud-button" id="create" type="button" disabled={busy} onClick={()=>submit(false)}>Criar sala</button>
      <button className="hud-button hud-button--secondary" type="button" disabled={busy} onClick={()=>submit(false,true)}>Aprender a jogar</button></>}
      <div className={invited ? "join-fields join-invite" : "join-fields"}>
        <label>Código da sala <input key={roomCode} id="room-id" name="room-id" maxLength={64} autoComplete="off"
          defaultValue={roomCode} required/></label>
        <button className="hud-button hud-button--secondary" type="submit" disabled={busy}>Entrar</button>
      </div>
    </form>
    <p id="connection" role="status">{message}</p>
  </>;
}

export function mountRoomEntrance(host:HTMLElement,initialNick:string,initialCode:string,onConnect:Props['onConnect']) {
  const root = createRoot(host);
  let input:HTMLInputElement|null = null;
  const nickRef = (element:HTMLInputElement|null) => { input = element; };
  let roomCode = initialCode;
  let busy = false;
  let message = '';

  function render() {
    root.render(<RoomEntrance initialNick={initialNick} invited={!!initialCode} roomCode={roomCode} busy={busy}
      message={message} onConnect={onConnect} nickRef={nickRef}/>);
  }
  render();
  return {
    update(next:Partial<{busy:boolean;message:string}>) {
      busy = next.busy ?? busy;
      message = next.message ?? message;
      render();
    },
    setRoomCode(code:string) {
      roomCode = code;
      render();
    },
    focusNick() { input?.focus(); },
  };
}
