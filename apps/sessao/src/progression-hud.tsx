import { DialogDismiss } from './ui/dialog-dismiss';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CSSProperties } from 'react';
import { characterStats } from './character-stats';
import type { Player } from './map';
import type { PlenaryView } from './plenary';
import { missionReward, money } from './politics';
import { attributeUpgrades, baseAttribute, baseDefense, baseStamina, type Attribute, type AttributeRequest, type Progression } from './progression';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const pointLabel = (points:number) => points===1 ? '1 ponto' : `${points} pontos`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createProgressionHud(send:(request:AttributeRequest)=>void, play:(cue:'levelUp'|'attribute')=>void) {
  const reward = element('profile-xp-reward');
  const launch = element<HTMLButtonElement>('open-attributes');
  const badge = element('attribute-points-badge');
  const celebration = element<HTMLDialogElement>('level-up-dialog');
  const attributes = element<HTMLDialogElement>('attributes-dialog');
  const attributesRoot = createRoot(attributes);
  const celebrationRoot = createRoot(celebration);
  const keys = Object.keys(attributeUpgrades) as Attribute[];
  let selected:Attribute|undefined;
  let attributesKey = '';

  let latest:Progression|undefined;
  let view:PlenaryView|undefined;
  let player:Player|undefined;
  let rewardTimer:number|undefined;
  let revealTimer:number|undefined;
  let requestTimer:number|undefined;
  let requested:number|undefined;
  let pending:{from:number;to:number}|undefined;
  let displayed:{from:number;to:number}|undefined;
  let reconnecting = false;
  let completedCount = 0;

  function confirmAttribute() {
    if (!latest || !selected || requested===latest.revision || !latest.available) return;
    requested = latest.revision;
    clearTimeout(requestTimer);
    requestTimer = window.setTimeout(()=>{ requested = undefined; renderAttributes(); },1000);
    renderAttributes();
    send({attribute:selected,revision:latest.revision,matchId:latest.matchId});
  }

  function clearSelection() {
    selected = undefined;
    renderAttributes();
  }
  attributes.addEventListener('close',clearSelection);

  function renderAttributes() {
    if (!latest || !player) return;
    const {xp,level,nextLevelXp,available,invested,revision} = latest;
    const stats = characterStats[player.character];
    const staminaMax = baseStamina+invested.stamina*attributeUpgrades.stamina.bonus;
    const maxHp = stats.hp+invested.hp*attributeUpgrades.hp.bonus;
    const values = {hp:maxHp,stamina:staminaMax,attack:stats.attack+invested.attack*attributeUpgrades.attack.bonus,
      defense:baseDefense+invested.defense*attributeUpgrades.defense.bonus};
    const hp = view?.gameplay?.vitality?.hp ?? maxHp;
    const stamina = Math.floor(player.stamina ?? staminaMax);
    const canSpend = !!available && requested!==revision && view?.phase==='negotiation' &&
      !player.knockedOut && !player.carrying && !!view.gameplay;
    const key = JSON.stringify([xp,level,nextLevelXp,available,invested,values,hp,stamina,selected,canSpend]);
    if (key===attributesKey) return;
    attributesKey = key;
    flushSync(()=>attributesRoot.render(<>
      <header><div><h2 id="attributes-title" className="sr-only">Atributos</h2>
        <p id="attributes-xp">Nível {level} · {xp} XP totais · {nextLevelXp===undefined ? 'MAX' : `${nextLevelXp-xp} XP para o próximo nível`}</p>
      </div><DialogDismiss className="hud-button hud-button--secondary">Fechar</DialogDismiss></header>
      <p id="attributes-available" role="status">{pointLabel(available)} para distribuir</p>
      <div className="attribute-columns">
        <section className="attribute-panel" aria-label="Atributos"><div id="attribute-list">
          {keys.map((attribute,index)=>{
            const {label,resource,bonus} = attributeUpgrades[attribute];
            const preview = attribute===selected && !!available;
            return <section key={attribute} data-attribute={attribute} className={preview ? 'attribute-selected' : undefined}>
              <div><strong>{label}</strong><small>+1 dá +{bonus} {attribute==='hp' ? 'PV máximos' : attribute==='stamina' ? 'stamina máxima' : resource}</small></div>
              <span>{baseAttribute+invested[attribute]}</span>
              <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts={String(index+1)}
                aria-label={`Investir em ${label}`} aria-pressed={preview} disabled={!canSpend}
                onClick={()=>{ selected = attribute; renderAttributes(); }}>+1</button>
            </section>;
          })}
        </div></section>
        <section className="attribute-panel" aria-label="Estatísticas de combate"><div id="attribute-resources">
          {keys.map(attribute=>{
            const max = values[attribute];
            const {resource,bonus} = attributeUpgrades[attribute];
            const current = attribute==='hp' ? `${hp}/${max}` : attribute==='stamina' ? `${stamina}/${max}` : String(max);
            const next = attribute==='hp' ? `${hp+bonus}/${max+bonus}` : attribute==='stamina' ? `${stamina+bonus}/${max+bonus}` : String(max+bonus);
            const preview = attribute===selected && !!available;
            return <section key={attribute}><strong>{resource}</strong><span className={preview ? 'attribute-preview' : undefined}>
              {preview ? current+' → '+next : current}</span></section>;
          })}
        </div></section>
      </div>
      <div className="progression-buttons"><button id="confirm-attribute" type="button" className="hud-button"
        aria-keyshortcuts="5" disabled={!canSpend || !selected} onClick={confirmAttribute}>Confirmar +1</button></div>
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
      <form method="dialog" className="progression-buttons">
        <button className="hud-button" value="allocate" aria-keyshortcuts="1">Distribuir ponto</button>
        <button className="hud-button hud-button--secondary" value="later" aria-keyshortcuts="2" autoFocus>Depois</button>
      </form>
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
  launch.onclick = openAttributes;
  celebration.addEventListener('close',closeCelebration);
  document.addEventListener('close',closeOtherDialog,true);

  return {
    render(next:PlenaryView) {
      view = next;
      const progress = next.politics?.progression;
      const before = latest?.matchId===progress?.matchId && !reconnecting ? latest : undefined;
      reconnecting = false;
      latest = progress;
      launch.hidden = !progress || next.phase==='lobby' || next.phase==='finished';
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
      badge.hidden = !progress.available;
      badge.textContent = String(progress.available);
      launch.title = progress.available ? `Atributos (I) · ${pointLabel(progress.available)} para distribuir` : 'Atributos (I)';
      launch.setAttribute('aria-label',progress.available ? `Atributos, ${pointLabel(progress.available)} para distribuir` : 'Atributos');
      if (!before) {
        pending = undefined;
        clearTimeout(revealTimer);
        revealTimer = undefined;
        clearTimeout(rewardTimer);
        reward.textContent = '';
        if (celebration.open) celebration.close('later');
      }
      if (before && progress.xp>before.xp) {
        const previousCount = completedCount;
        const extras = next.politics?.missions.completed.slice(previousCount).map(mission=>missionReward(mission.kind)) ?? [];
        const cash = extras.reduce((sum,earned)=>sum+(earned.cash ?? 0),0);
        const popularity = extras.reduce((sum,earned)=>sum+(earned.popularity ?? 0),0);
        reward.textContent = [`+${progress.xp-before.xp} XP`,cash ? `+${money(cash)}` : '',
          popularity ? `+${popularity} popularidade` : ''].filter(Boolean).join(' · ');
        clearTimeout(rewardTimer);
        rewardTimer = window.setTimeout(()=>reward.textContent='',2700);
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
      if (!before || progress.revision!==before.revision) selected = undefined;
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
    player(snapshot:Player) { player = snapshot; if (attributes.open) renderAttributes(); },
    reconnect() { reconnecting = true; },
    destroy() {
      clearTimeout(revealTimer);
      clearTimeout(rewardTimer);
      clearTimeout(requestTimer);
      document.removeEventListener('close',closeOtherDialog,true);
      celebration.removeEventListener('close',closeCelebration);
      celebration.close();
      attributes.removeEventListener('close',clearSelection);
      attributes.close();
      attributesRoot.unmount();
      celebrationRoot.unmount();
      launch.hidden = true;
      reward.textContent = '';
      launch.onclick = null;
    },
  };

}
