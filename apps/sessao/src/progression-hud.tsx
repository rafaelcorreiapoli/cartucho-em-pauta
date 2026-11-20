import type { ShortcutEntry } from './action-shortcuts';
import {useDialogKeys} from './ui/use-dialog-keys';
import { DialogDismiss } from './ui/dialog-dismiss';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CSSProperties } from 'react';
import type { Player } from './map';
import type { PlenaryView } from './plenary';
import { missionReward, money } from './politics';
import { attributeUpgrades, attributeEffect, type Attribute, type AttributeRequest, type Progression } from './progression';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const pointLabel = (points:number) => points===1 ? '1 ponto' : `${points} pontos`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function attributePlayerView(player:Player) {
  return {unavailable:!!(player.knockedOut || player.carrying || player.carried)};
}

export function canSelectAttribute(view:PlenaryView|undefined, player:ReturnType<typeof attributePlayerView>|undefined) {
  return !!player && !player.unavailable && !!view?.gameplay && view.phase==='negotiation' &&
    view.ballotCountdown===undefined && view.isolationSeconds===undefined;
}

function AvailablePoints({points, actionForKey}:{
  points:number; actionForKey:(key:string)=>(()=>void)|undefined;
}) {
  const label = useDialogKeys<HTMLParagraphElement>(actionForKey);
  return <p ref={label} id="attributes-available" role="status">{pointLabel(points)} para distribuir</p>;
}

function CelebrationChoices({choose}:{choose:(choice:'allocate'|'later')=>void}) {
  const form = useDialogKeys<HTMLFormElement>(key=>{
    if (key==='1') return ()=>choose('allocate');
    if (key==='2') return ()=>choose('later');
  });
  return <form ref={form} method="dialog" className="progression-buttons">
    <button className="hud-button" value="allocate" aria-keyshortcuts="1">Distribuir ponto</button>
    <button className="hud-button hud-button--secondary" value="later" aria-keyshortcuts="2" autoFocus>Depois</button>
  </form>;
}

export function createProgressionHud(send:(request:AttributeRequest)=>void, play:(cue:'levelUp'|'attribute')=>void,reward:(text:string)=>void) {
  const celebration = element<HTMLDialogElement>('level-up-dialog');
  const attributes = element<HTMLDialogElement>('attributes-dialog');
  const attributesRoot = createRoot(attributes);
  const celebrationRoot = createRoot(celebration);
  const keys = Object.keys(attributeUpgrades) as Attribute[];
  let attributesKey = '';

  let latest:Progression|undefined;
  let view:PlenaryView|undefined;
  let player:ReturnType<typeof attributePlayerView>|undefined;
  let rewardTimer:number|undefined;
  let revealTimer:number|undefined;
  let requestTimer:number|undefined;
  let requested:number|undefined;
  let pending:{from:number;to:number}|undefined;
  let displayed:{from:number;to:number}|undefined;
  let reconnecting = false;
  let completedCount = 0;

  const canSpendPoint = () => !!latest?.available && requested!==latest.revision && canSelectAttribute(view,player);
  function invest(attribute:Attribute) {
    if (!attributes.open || !latest || !canSpendPoint()) return;
    requested = latest.revision;
    clearTimeout(requestTimer);
    requestTimer = window.setTimeout(()=>{ requested = undefined; renderAttributes(); },1000);
    renderAttributes();
    send({attribute,revision:latest.revision,matchId:latest.matchId});
  }

  function renderAttributes() {
    if (!latest || !player) return;
    const {level,available,invested} = latest;
    const canSpend = canSpendPoint();
    const key = JSON.stringify([level,available,invested,canSpend]);
    if (key===attributesKey) return;
    attributesKey = key;
    const actionForKey = (key:string) => {
      if (!canSpend) return;
      const attribute = /^[1-4]$/.test(key) ? keys[Number(key)-1] : undefined;
      if (attribute) return ()=>invest(attribute);
    };
    flushSync(()=>attributesRoot.render(<>
      <header><div><h2 id="attributes-title">Especializações</h2>
        <p id="attributes-xp">Nível {level} · Escolha onde investir cada ponto.</p>
      </div><DialogDismiss className="hud-button hud-button--secondary">Fechar</DialogDismiss></header>
      <AvailablePoints points={available} actionForKey={actionForKey}/>
      <section id="attribute-list" aria-label="Especializações">
        {keys.map((attribute,index)=>{
          const {label,description} = attributeUpgrades[attribute];
          const points = invested[attribute];
          return <section key={attribute} data-attribute={attribute}>
            <div><strong>{label}</strong><span className="attribute-points">{pointLabel(points)}</span>
              <small>{description}</small>
              <p className="attribute-effect"><span className="attribute-current">{attributeEffect(attribute,points)}</span>
                {!!available && <span className="attribute-next"> → {attributeEffect(attribute,points+1)}</span>}</p>
            </div>
            <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts={String(index+1)}
              aria-label={`Investir em ${label}`} disabled={!canSpend}
              onClick={()=>invest(attribute)}><span>+1</span><kbd className="action-key" aria-hidden="true">{index+1}</kbd></button>
          </section>;
        })}
      </section>
    </>));
  }

  function updateCelebration({from,to}:{from:number;to:number}) {
    flushSync(()=>celebrationRoot.render(<>
      <div className="level-up-rays" aria-hidden="true"/>
      <div className="level-up-sparks" aria-hidden="true">{Array.from({length:16},(_,index)=>
        <i key={index} style={{'--angle':`${index*22.5}deg`,'--distance':`${90+(index%4)*27}px`,'--delay':`${index%5*27}ms`} as CSSProperties}/>)}</div>
      <header><h2 id="level-up-title">LEVEL UP!</h2>
        <div className="level-up-number"><span>NÍVEL</span><strong id="level-up-level">{to-from>1 ? `${from} → ${to}` : to}</strong></div>
        <p id="level-up-points">+{pointLabel(to-from)} de atributo</p>
      </header>
      <CelebrationChoices choose={choice=>celebration.close(choice)}/>
    </>));
  }

  function tryReveal() {
    if (!pending || revealTimer!==undefined || view?.phase!=='negotiation' || document.querySelector('dialog[open]')) return;
    displayed = pending;
    pending = undefined;
    updateCelebration(displayed);
    celebration.returnValue = '';
    celebration.showModal();
    play('levelUp');
  }

  function closeCelebration() {
    displayed = undefined;
    if (celebration.returnValue==='allocate' && view?.phase==='negotiation') openAttributes();
  }

  function closeOtherDialog(event:Event) {
    if (event.target!==celebration) tryReveal();
  }

  function openAttributes() {
    if (document.querySelector('dialog[open]')) return;
    renderAttributes();
    attributes.showModal();
  }
  celebration.addEventListener('close',closeCelebration);
  document.addEventListener('close',closeOtherDialog,true);

  return {
    open:openAttributes,
    shortcuts(scope:HTMLElement):ShortcutEntry[]|undefined {
      if (scope===celebration) return [
        {name:'Distribuir ponto',activate:()=>{ if (celebration.open) celebration.close('allocate'); }},
        {name:'Depois',activate:()=>{ if (celebration.open) celebration.close('later'); }},
      ];
      if (scope!==attributes) return;
      const entries:ShortcutEntry[] = [{name:'Fechar',activate:()=>attributes.close()}];
      if (canSpendPoint()) {
        entries.push(...keys.map(attribute=>({name:'Investir em '+attributeUpgrades[attribute].label,activate:()=>invest(attribute)})));
      }
      return entries;
    },
    render(next:PlenaryView) {
      view = next;
      const progress = next.politics?.progression;
      const before = latest?.matchId===progress?.matchId && !reconnecting ? latest : undefined;
      reconnecting = false;
      latest = progress;
      if (next.phase!=='negotiation') {
        if (celebration.open) celebration.close('later');
        if (attributes.open) attributes.close();
      }
      if (!progress || next.phase==='finished') pending = undefined;
      if (!progress) return;
      if (requested!==progress.revision || !before) {
        clearTimeout(requestTimer);
        requested = undefined;
      }
      if (!before) {
        pending = undefined;
        clearTimeout(revealTimer);
        revealTimer = undefined;
        clearTimeout(rewardTimer);
        reward('');
        if (celebration.open) celebration.close('later');
      }
      if (before && progress.xp>before.xp) {
        const previousCount = completedCount;
        const extras = next.politics?.missions.completed.slice(previousCount).map(mission=>missionReward(mission.kind)) ?? [];
        const cash = extras.reduce((sum,earned)=>sum+(earned.cash ?? 0),0);
        const popularity = extras.reduce((sum,earned)=>sum+(earned.popularity ?? 0),0);
        reward([`+${progress.xp-before.xp} XP`,cash ? `+${money(cash)}` : '',
          popularity ? `+${popularity} popularidade` : ''].filter(Boolean).join(' · '));
        clearTimeout(rewardTimer);
        rewardTimer = window.setTimeout(()=>reward(''),2700);
      }
      if (before && progress.level>before.level && celebration.open && displayed) {
        displayed.to = progress.level;
        updateCelebration(displayed);
      } else if (before && progress.level>before.level && next.phase!=='finished') {
        pending = {from:pending?.from ?? before.level,to:progress.level};
        clearTimeout(revealTimer);
        revealTimer = window.setTimeout(()=>{ revealTimer = undefined; tryReveal(); },reduceMotion() ? 0 : 250);
      } else if (pending && next.phase==='negotiation' && !celebration.open && before?.xp===progress.xp) {
        tryReveal();
      }
      completedCount = next.politics?.missions.completed.length ?? 0;
      if (before && progress.revision>before.revision) {
        play('attribute');
        if (attributes.open) {
          renderAttributes();
          for (const attribute of keys) {
            if (progress.invested[attribute]>before.invested[attribute] && !reduceMotion()) {
              attributes.querySelector(`[data-attribute="${attribute}"]`)?.animate(
                [{backgroundColor:'#416b46'},{backgroundColor:'transparent'}],{duration:460});
            }
          }
        }
      }
      if (attributes.open) renderAttributes();
    },
    player(snapshot:Player) {
      const next = attributePlayerView(snapshot);
      if (player?.unavailable===next.unavailable) return;
      player = next;
      if (attributes.open) renderAttributes();
    },
    reconnect() { reconnecting = true; },
    destroy() {
      clearTimeout(revealTimer);
      clearTimeout(rewardTimer);
      clearTimeout(requestTimer);
      document.removeEventListener('close',closeOtherDialog,true);
      celebration.removeEventListener('close',closeCelebration);
      celebration.close();
      attributes.close();
      attributesRoot.unmount();
      celebrationRoot.unmount();
      reward('');
    },
  };

}
