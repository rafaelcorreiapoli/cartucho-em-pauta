import { setCharacterPortrait } from './character-art';
import type { CampaignBroadcast } from './elections';
import './campaign-tv.css';

const airtime = 4_000;
const slideTime = 280;

export function createCampaignTv(session:HTMLElement, localPlayerId:string) {
  const tv = document.createElement('div');
  tv.className = 'campaign-tv';
  tv.hidden = true;
  const frame = new Image();
  frame.src = '/assets/campaign-tv.webp';
  frame.alt = '';
  frame.width = 960;
  frame.height = 640;

  const screen = document.createElement('div');
  screen.className = 'campaign-tv-screen';
  const portrait = document.createElement('span');
  portrait.className = 'portrait';
  portrait.setAttribute('aria-hidden','true');
  const caption = document.createElement('div');
  caption.className = 'campaign-tv-caption';
  const name = document.createElement('span');
  const number = document.createElement('strong');
  caption.append(name,number);
  screen.append(portrait,caption);
  tv.append(frame,screen);

  const announcement = document.createElement('span');
  announcement.className = 'campaign-tv-announcement';
  announcement.setAttribute('role','status');
  session.append(tv,announcement);

  const pending:CampaignBroadcast[] = [];
  let playback:Animation | undefined;

  function playNext() {
    const ad = pending.shift();
    playback = undefined;
    tv.hidden = !ad;
    if (!ad) {
      announcement.textContent = '';
      return;
    }
    const own = ad.advertiserId===localPlayerId;
    tv.dataset.side = own ? 'left' : 'right';
    setCharacterPortrait(portrait,ad.character);
    name.textContent = `Vote ${ad.name}`;
    number.textContent = String(ad.number);
    announcement.textContent = `Propaganda eleitoral. Vote ${ad.name}, número ${ad.number}.`;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? airtime : airtime+2*slideTime;
    const edge = own ? 'translateX(calc(-100% - 3rem))' : 'translateX(calc(100% + 3rem))';
    playback = tv.animate(reducedMotion ? [] : [
      {transform:edge,easing:'ease-out'},
      {transform:'none',offset:slideTime/duration},
      {transform:'none',offset:1-slideTime/duration,easing:'ease-in'},
      {transform:edge},
    ], {duration,fill:'forwards'});
    playback.onfinish = () => {
      playback?.cancel();
      playNext();
    };
  }

  return {
    enqueue(ad:CampaignBroadcast) {
      pending.push(ad);
      if (!playback) playNext();
    },
    destroy() {
      playback?.cancel();
      pending.length = 0;
      tv.remove();
      announcement.remove();
    },
  };
}
