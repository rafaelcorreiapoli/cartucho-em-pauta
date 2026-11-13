import { characterStats } from './character-stats';
import type { Player } from './map';
import type { PlenaryView } from './plenary';
import { missionReward, money } from './politics';
import { attributeUpgrades, baseAttribute, baseDefense, baseStamina, type Attribute, type AttributeRequest, type Progression } from './progression';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const pointLabel = (points:number) => points===1 ? '1 ponto' : `${points} pontos`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createProgressionHud(send:(request:AttributeRequest)=>void, play:(cue:'levelUp'|'attribute')=>void) {
  const xpPanel = element('profile-xp');
  const levelLabel = element('profile-level');
  const xpLabel = element('profile-xp-value');
  const fill = element('profile-xp-fill');
  const reward = element('profile-xp-reward');
  const launch = element<HTMLButtonElement>('open-attributes');
  const badge = element('attribute-points-badge');
  const celebration = element<HTMLDialogElement>('level-up-dialog');
  const attributes = element<HTMLDialogElement>('attributes-dialog');
  const confirm = element<HTMLButtonElement>('confirm-attribute');
  let selected:Attribute|undefined;
  const sparks = element('level-up-dialog').querySelector('.level-up-sparks')!;
  for (let index=0;index<16;index++) {
    const spark = document.createElement('i');
    spark.style.setProperty('--angle',`${index*22.5}deg`);
    spark.style.setProperty('--distance',`${90+(index%4)*27}px`);
    spark.style.setProperty('--delay',`${index%5*27}ms`);
    sparks.append(spark);
  }

  const rows = (Object.keys(attributeUpgrades) as Attribute[]).map((attribute,index)=>{
    const row = document.createElement('section');
    const info = document.createElement('div');
    const label = document.createElement('strong');
    const resourceRow = document.createElement('section');
    const resourceLabel = document.createElement('strong');
    const resourceValue = document.createElement('span');
    const {label:attributeLabel,resource,bonus} = attributeUpgrades[attribute];
    const value = document.createElement('span');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary';
    button.textContent = '+1';
    button.title = `+1 ${attributeLabel} · +${bonus} ${resource}`;
    button.setAttribute('aria-keyshortcuts',String(index+1));
    button.setAttribute('aria-label',`Investir em ${attributeUpgrades[attribute].label}`);
    label.textContent = attributeUpgrades[attribute].label;
    const benefit = document.createElement('small');
    benefit.textContent = `+1 dá +${bonus} ${attribute==='hp' ? 'PV máximos' : attribute==='stamina' ? 'stamina máxima' : resource}`;
    info.append(label,benefit);
    resourceLabel.textContent = resource;
    resourceRow.append(resourceLabel,resourceValue);
    element('attribute-resources').append(resourceRow);
    row.append(info,value,button);
    element('attribute-list').append(row);
    button.onclick = () => {
      selected = attribute;
      renderAttributes();
    };
    return {attribute,row,value,resourceValue,button};
  });

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

  confirm.onclick = () => {
    if (!latest || !selected || confirm.disabled) return;
    requested = latest.revision;
    clearTimeout(requestTimer);
    requestTimer = window.setTimeout(()=>{ requested = undefined; renderAttributes(); },1000);
    renderAttributes();
    send({attribute:selected,revision:latest.revision,matchId:latest.matchId});
  };

  function clearSelection() {
    selected = undefined;
    renderAttributes();
  }
  attributes.addEventListener('close',clearSelection);

  function renderAttributes() {
    if (!latest || !player) return;
    const {xp,level,nextLevelXp,available,invested,revision} = latest;
    element('attributes-xp').textContent = `Nível ${level} · ${xp} XP totais · ${nextLevelXp===undefined ? 'MAX' : `${nextLevelXp-xp} XP para o próximo nível`}`;
    element('attributes-available').textContent = `${pointLabel(available)} para distribuir`;
    const stats = characterStats[player.character];
    const staminaMax = baseStamina+invested.stamina*attributeUpgrades.stamina.bonus;
    const maxHp = stats.hp+invested.hp*attributeUpgrades.hp.bonus;
    const values = {hp:maxHp,stamina:staminaMax,attack:stats.attack+invested.attack*attributeUpgrades.attack.bonus,
      defense:baseDefense+invested.defense*attributeUpgrades.defense.bonus};
    const hp = view?.gameplay?.vitality?.hp ?? maxHp;
    const stamina = Math.floor(player.stamina ?? staminaMax);
    const canSpend = !!available && requested!==revision && view?.phase==='negotiation' &&
      !player.knockedOut && !player.carrying && !!view.gameplay;
    confirm.disabled = !canSpend || !selected;
    for (const {attribute,row,value,resourceValue,button} of rows) {
      const max = values[attribute];
      const current = attribute==='hp' ? `${hp}/${max}` : attribute==='stamina' ? `${stamina}/${max}` : String(max);
      value.textContent = String(baseAttribute+invested[attribute]);
      const preview = attribute===selected && !!available;
      button.setAttribute('aria-pressed',String(preview));
      row.classList.toggle('attribute-selected',preview);
      resourceValue.classList.toggle('attribute-preview',preview);
      const bonus = attributeUpgrades[attribute].bonus;
      const next = attribute==='hp' ? `${hp+bonus}/${max+bonus}` :
        attribute==='stamina' ? `${stamina+bonus}/${max+bonus}` : String(max+bonus);
      resourceValue.textContent = preview ? `${current} → ${next}` : current;
      button.disabled = !canSpend;
    }
  }

  function updateCelebration({from,to}:{from:number;to:number}) {
    element('level-up-level').textContent = to-from>1 ? `${from} → ${to}` : String(to);
    element('level-up-points').textContent = `+${pointLabel(to-from)} de atributo`;
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
    if (celebration.returnValue==='allocate' && view?.phase==='negotiation') attributes.showModal();
  }

  function closeOtherDialog(event:Event) {
    if (event.target!==celebration) tryReveal();
  }

  launch.onclick = () => { if (!document.querySelector('dialog[open]')) attributes.showModal(); };
  celebration.addEventListener('close',closeCelebration);
  document.addEventListener('close',closeOtherDialog,true);

  return {
    render(next:PlenaryView) {
      view = next;
      const progress = next.politics?.progression;
      const before = latest?.matchId===progress?.matchId && !reconnecting ? latest : undefined;
      reconnecting = false;
      latest = progress;
      levelLabel.hidden = xpPanel.hidden = !progress || next.phase==='lobby';
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
      const inLevel = progress.xp-progress.levelStart;
      const step = progress.nextLevelXp===undefined ? 0 : progress.nextLevelXp-progress.levelStart;
      const fraction = step ? inLevel/step : 1;
      levelLabel.textContent = `NV ${progress.level}`;
      levelLabel.setAttribute('aria-label',`Nível ${progress.level}`);
      xpLabel.textContent = step ? `${inLevel} / ${step} XP` : 'MAX';
      if (!before) {
        pending = undefined;
        clearTimeout(revealTimer);
        revealTimer = undefined;
        clearTimeout(rewardTimer);
        reward.textContent = '';
        fill.getAnimations().forEach(animation=>animation.cancel());
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
        if (!reduceMotion()) fill.animate([{transform:fill.style.transform || 'scaleX(0)'},{transform:'scaleX(1)'}],{duration:250,easing:'ease-out'});
        clearTimeout(revealTimer);
        revealTimer = window.setTimeout(()=>{ revealTimer = undefined; tryReveal(); },reduceMotion() ? 0 : 250);
      } else if (pending && next.phase==='negotiation' && !celebration.open && before?.xp===progress.xp) {
        tryReveal();
      }
      fill.style.transform = `scaleX(${fraction})`;
      completedCount = next.politics?.missions.completed.length ?? 0;
      if (!before || progress.revision!==before.revision) selected = undefined;
      if (before && progress.revision>before.revision) {
        play('attribute');
        for (const row of rows) {
          if (progress.invested[row.attribute]>before.invested[row.attribute] && !reduceMotion()) {
            row.row.animate([{backgroundColor:'#416b46'},{backgroundColor:'transparent'}],{duration:460});
          }
        }
      }
      renderAttributes();
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
      confirm.onclick = null;
      launch.onclick = null;
      launch.hidden = levelLabel.hidden = xpPanel.hidden = true;
      sparks.replaceChildren();
      element('attribute-list').replaceChildren();
      element('attribute-resources').replaceChildren();
    },
  };

}
