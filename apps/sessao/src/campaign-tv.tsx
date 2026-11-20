import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import type {CampaignBroadcast} from './elections';
import {CharacterPortrait} from './ui/character-portrait';
import './campaign-tv.css';

const airtime = 4_000;
const slideTime = 280;

export function CampaignTv({ad,localPlayerId,sequence,reducedMotion}:{
  ad?:CampaignBroadcast; localPlayerId:string; sequence:number; reducedMotion:boolean;
}) {
  return <>
    {ad && <div key={sequence} className="campaign-tv"
      data-side={ad.advertiserId===localPlayerId ? 'left' : 'right'}
      style={{animationDuration:reducedMotion ? '0ms' : `${airtime+2*slideTime}ms`}}>
      <img src="/assets/campaign-tv.webp" alt="" width={960} height={640}/>
      <div className="campaign-tv-screen">
        <CharacterPortrait character={ad.character}/>
        <div className="campaign-tv-caption"><span>Vote {ad.name}</span><strong>{ad.number}</strong></div>
      </div>
    </div>}
    <span className="campaign-tv-announcement" role="status" aria-atomic="true">
      {ad && `Propaganda eleitoral. Vote ${ad.name}, número ${ad.number}.`}
    </span>
  </>;
}

export function createCampaignTv(session:HTMLElement, localPlayerId:string,onBroadcast:()=>void=()=>{}) {
  const host = document.createElement('div');
  host.className = 'campaign-tv-host';
  session.append(host);
  const root = createRoot(host);
  const pending:CampaignBroadcast[] = [];
  let timer:ReturnType<typeof setTimeout>|undefined;
  let sequence = 0;
  let destroyed = false;

  const equipment = session.querySelector('.character-dock');
  const agenda = session.querySelector('#agenda-dock');
  const gap = 8;
  function positionTv() {
    const bounds = session.getBoundingClientRect();
    const equipmentBounds = equipment?.getBoundingClientRect();
    const agendaBounds = agenda?.getBoundingClientRect();
    if (!bounds.height || !equipmentBounds?.height) return;
    const top = equipmentBounds.bottom + gap;
    const bottom = (agendaBounds?.height ? agendaBounds.top : bounds.bottom) - gap;
    const height = Math.max(0,bottom-top);
    host.style.setProperty('--campaign-tv-top', `${top-bounds.top+height/2}px`);
    host.style.setProperty('--campaign-tv-width', `${height*1.5}px`);
  }
  const layout = new ResizeObserver(positionTv);
  layout.observe(session);
  if (equipment) layout.observe(equipment);
  if (agenda) layout.observe(agenda);

  function playNext() {
    const ad = pending.shift();
    if (ad) positionTv();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flushSync(()=>root.render(<CampaignTv ad={ad} localPlayerId={localPlayerId} sequence={++sequence} reducedMotion={reducedMotion}/>));
    if (ad) onBroadcast();
    timer = ad ? setTimeout(playNext,reducedMotion ? airtime : airtime+2*slideTime) : undefined;
  }

  playNext();
  return {
    enqueue(ad:CampaignBroadcast) {
      if (destroyed) return;
      pending.push(ad);
      if (timer===undefined) playNext();
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      layout.disconnect();
      pending.length = 0;
      root.unmount();
      host.remove();
    },
  };
}
