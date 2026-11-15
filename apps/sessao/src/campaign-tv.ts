import { setCharacterPortrait } from './character-art';
import type { CampaignAdvertisement } from './elections';
import './campaign-tv.css';

const airtime = 4_000;

export function createCampaignTv(session:HTMLElement) {
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

  const pending:CampaignAdvertisement[] = [];
  let timer:number | undefined;

  function playNext() {
    const ad = pending.shift();
    timer = undefined;
    tv.hidden = !ad;
    if (!ad) {
      announcement.textContent = '';
      return;
    }
    setCharacterPortrait(portrait,ad.character);
    name.textContent = `Vote ${ad.name}`;
    number.textContent = String(ad.number);
    announcement.textContent = `Propaganda eleitoral. Vote ${ad.name}, número ${ad.number}.`;
    timer = window.setTimeout(playNext,airtime);
  }

  return {
    enqueue(ad:CampaignAdvertisement) {
      pending.push(ad);
      if (timer===undefined) playNext();
    },
    destroy() {
      window.clearTimeout(timer);
      pending.length = 0;
      tv.remove();
      announcement.remove();
    },
  };
}
