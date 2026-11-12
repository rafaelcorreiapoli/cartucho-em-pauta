import { ChatCircleDots, PaperPlaneRight, X } from '@phosphor-icons/react';
import type { Side } from '@brwars/simulation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { MatchChatChannel } from '../session';
import './match-chat.css';

export function MatchChat({ channel, side }: { channel: MatchChatChannel; side: Side }) {
  const messages = useSyncExternalStore(channel.subscribe, channel.getMessages);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [seen, setSeen] = useState(0);
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const latestId = messages.at(-1)?.id ?? 0;
  const unread = messages.filter((message) => message.side !== side && message.id > seen).length;
  useEffect(() => {
    function openComposer(event: KeyboardEvent) {
      if (
        event.key !== 'Enter' ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        document.querySelector('[role="dialog"], [data-game-loading]') ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest('input, textarea, select, [data-match-chat]')))
      )
        return;
      event.preventDefault();
      if (open) input.current?.focus({ preventScroll: true });
      else setOpen(true);
    }
    document.addEventListener('keydown', openComposer);
    return () => document.removeEventListener('keydown', openComposer);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages]);

  function close() {
    setSeen(latestId);
    setOpen(false);
    requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    try {
      channel.send(text);
      setDraft('');
      setError('');
      input.current?.focus({ preventScroll: true });
    } catch {
      setError('Conexão indisponível. Tente novamente.');
    }
  }
  return (
    <aside
      className="match-chat"
      data-match-chat
      aria-label="Chat da partida"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          close();
        }
      }}
    >
      {open ? (
        <div className="match-chat-panel">
          <header>
            <strong>Chat da partida</strong>
            <button type="button" aria-label="Recolher chat" onClick={close}>
              <X />
            </button>
          </header>
          <div className="match-chat-log" ref={log} role="log" aria-label="Mensagens" tabIndex={0}>
            {messages.length === 0 && <p className="match-chat-empty">Nenhuma mensagem ainda.</p>}
            {messages.map((message) => (
              <p key={message.id}>
                <b className={message.side === side ? 'ally' : 'opponent'} dir="auto">
                  {message.nick}
                </b>{' '}
                <span dir="auto">{message.text}</span>
              </p>
            ))}
          </div>
          <form onSubmit={send}>
            <input
              ref={input}
              aria-label="Mensagem"
              placeholder="Digite uma mensagem…"
              maxLength={240}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" aria-label="Enviar mensagem" disabled={!draft.trim()}>
              <PaperPlaneRight weight="fill" />
            </button>
          </form>
          {error && <p role="status">{error}</p>}
        </div>
      ) : (
        <button
          ref={toggle}
          className="match-chat-toggle"
          type="button"
          aria-expanded={false}
          aria-keyshortcuts="Enter"
          title="Abrir chat da partida (Enter)"
          aria-label={unread ? `Abrir chat. Mensagens novas: ${unread}` : 'Abrir chat'}
          onClick={() => setOpen(true)}
        >
          <ChatCircleDots />
          Chat
          <kbd aria-hidden="true">Enter</kbd>
          {unread > 0 && <span aria-hidden="true">{unread}</span>}
        </button>
      )}
    </aside>
  );
}
