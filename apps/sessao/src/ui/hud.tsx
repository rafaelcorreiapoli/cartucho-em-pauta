import {AutomaticProjectsHud} from './automatic-projects';
import {caloteRules,publicBudgetLabel} from '../game-modes';
import {HudHelp} from './hud-help';
import {HudIcon} from './hud-icon';
import {PopularityReward} from './popularity-reward';
import {CharacterPortrait} from './character-portrait';
import {fireRules,fireSites,type FireView} from '../fire';
import {powerPanels} from '../power';
import {settingsApp} from '../hud-apps';
import { stabilityRules, publicDebtRules, publicDebtStabilityLoss } from '../plenary';
import { createRoot } from 'react-dom/client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { createHudModel, type HudModel } from './hud-model';
import { missionReward, missionTitle, money, timedAgendas, type Mission } from '../politics';
import './theme.css';

function Meter({label,value,max,tone,target}:{label:string;value:number;max:number;tone:string;target?:number}) {
  const fraction = Math.max(0,Math.min(1,value/max));
  return <div className="react-meter" data-tone={tone} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={max} aria-valuenow={fraction*max} aria-valuetext={String(value)}>
    <span style={{transform:'scaleX('+fraction+')'}}/>
    {target!==undefined && <i style={{left:(100*target/max)+'%'}}/>}
  </div>;
}

function Laurel({right=false}:{right?:boolean}) {
  return <svg className={`congress-laurel${right ? ' congress-laurel-right' : ''}`} viewBox="0 0 30 68" aria-hidden="true">
    <path d="M26 65C5 51 1 26 18 5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <path fill="currentColor" d="M16 13Q15 6 24 2Q24 9 16 13ZM12 22Q11 15 19 11Q20 18 12 22ZM9 31Q9 24 16 20Q18 28 9 31ZM10 40Q10 32 17 29Q19 36 10 40ZM13 49Q13 41 20 38Q22 46 13 49ZM18 57Q17 50 24 47Q26 53 18 57ZM11 22Q3 19 5 12Q12 15 11 22ZM8 32Q0 28 1 21Q9 24 8 32ZM9 42Q1 40 1 32Q9 34 9 42ZM13 51Q5 51 3 43Q11 43 13 51ZM19 60Q11 61 7 53Q15 53 19 60Z"/>
  </svg>;
}

function Parliament({state,countdown}:{state:HudModel['congress'];countdown:HudModel['countdown']}) {
  const values = useSyncExternalStore(state.subscribe,state.get);
  return <><ParliamentMetrics {...values}/><PlenaryCountdown state={countdown}/></>;
}

function PlenaryCountdown({state}:{state:HudModel['countdown']}) {
  const remaining = useSyncExternalStore(state.subscribe,state.get);
  if (remaining===undefined) return null;
  return <HudHelp as="div" help="Tempo até abrir a votação." className="plenary-countdown" data-kind={remaining.kind}><HudIcon name="clock"/>{remaining.kind==='cassation' ? 'Votação de cassação' : 'Votação de projeto'} em <strong>{remaining.seconds} s</strong></HudHelp>;
}

export function BudgetMeter({budget}:{budget:number}) {
  const limit = caloteRules.budgetMeterLimit;
  const width = Math.min(1,Math.abs(budget)/limit)*50;
  const direction = budget<0 ? 'negative' : budget>0 ? 'positive' : 'zero';
  return <div className="calote-budget-track" role="meter" aria-label="Orçamento público"
    aria-valuemin={-limit} aria-valuemax={limit} aria-valuenow={Math.max(-limit,Math.min(limit,budget))}
    aria-valuetext={publicBudgetLabel(budget)} data-direction={direction}>
    <span className="calote-budget-fill" style={{left:(budget<0 ? 50-width : 50)+'%',width:width+'%'}}/>
    <i className="calote-budget-center"/>
  </div>;
}

export function ParliamentMetrics({gameMode='classic',caloteIn,stability,budget,sessionRemaining,debtPenaltyIn}:ReturnType<HudModel['congress']['get']>) {
  const calote = gameMode==='calote';
  return <section className="congress-meter grid text-center" aria-label="Parlamento" data-game-mode={gameMode}>
    <div className="congress-emblem" aria-hidden="true">
      <svg viewBox="0 0 96 30">
        <path fill="currentColor" d="M39 2h6v25h-6zm9 0h6v25h-6zM2 26a16 11 0 0 1 32 0zm60-9h32a16 10 0 0 1-32 0zM0 28h96v2H0z"/>
      </svg>
    </div>
    <HudHelp className="congress-meter-label" aria-label={calote ? 'Como funciona o orçamento' : 'Como funciona a estabilidade'}
      help={calote ? 'Completar o tempo limite no vermelho dá vitória aos infiltrados. Deposite maletas na Tesouraria para recuperar o saldo.' : `A meta da sessão é ${stabilityRules.target}. A zero, o Parlamento entra em colapso.`}>{calote ? 'Orçamento público' : 'Estabilidade institucional'}</HudHelp>
    <HudHelp as="div" help={calote ? 'Zero fica no centro. Verde à direita é saldo positivo; vermelho à esquerda é dívida.' : 'A marca na barra indica a meta de estabilidade.'} className="congress-meter-track flex items-center">
      <Laurel/>
      {calote ? <div className="calote-budget-wrap">
        <strong className="tabular-nums calote-budget-value" data-in-debt={budget<0}>{publicBudgetLabel(budget)}</strong>
        <BudgetMeter budget={budget}/>
      </div> : <>
        <Meter label="Estabilidade institucional" value={stability} max={stabilityRules.maximum} tone={stability<stabilityRules.target ? 'danger' : 'stability'} target={stabilityRules.target}/>
        <strong className="tabular-nums">{stability}</strong>
      </>}
      <Laurel right/>
    </HudHelp>
    {calote && budget<0 && caloteIn!==undefined && <div className="calote-countdown" data-critical={caloteIn<=10} role="timer" aria-label="Tempo até o calote">
      <HudIcon name="clock"/><span>DERROTA POR CALOTE EM</span><strong>{caloteIn} s</strong>
    </div>}
    <div className="congress-summary-row">
    {!calote && <HudHelp aria-label="Orçamento Público" className="congress-budget flex items-center justify-center"
      data-in-debt={budget<0}
      help={`Projetos e salários usam este saldo. ${budget<0 ? `O orçamento está negativo: a dívida reduz a estabilidade em ${publicDebtStabilityLoss(budget)} a cada ${publicDebtRules.interval/1000} s.${debtPenaltyIn!==undefined ? ` Próxima perda em ${debtPenaltyIn} s.` : ''}` : 'A dívida reduz a estabilidade.'} Depósitos na Tesouraria abatem a dívida.`}>
      <HudIcon name="coins"/><strong className="tabular-nums">{budget<0 ? `−${money(-budget)}` : money(budget)}</strong>
    </HudHelp>}
    {sessionRemaining!==undefined && <HudHelp as="div" help="Tempo até o encerramento da sessão." className="congress-session-clock" role="timer"
      aria-label="Tempo restante da sessão" data-urgent={sessionRemaining<=60}>
      <HudIcon name="clock"/>
      <strong className="tabular-nums">{Math.floor(sessionRemaining/60)}:{String(sessionRemaining%60).padStart(2,'0')}</strong>
    </HudHelp>}
    </div>
  </section>;
}

export function PayrollMetrics({payroll}:{payroll:ReturnType<HudModel['congress']['get']>['payroll']}) {
  return payroll ? <HudHelp as="div" help="Valor total da folha, pago pelo orçamento público quando o relógio zera." className="congress-payroll" aria-label="Próxima distribuição de salários">
    <span className="payroll-label"><HudIcon name="wallet"/>Folha salarial</span>
    <strong className="tabular-nums">{money(payroll.cost)}</strong>
    <span className="payroll-countdown" role="timer"><HudIcon name="clock"/>{Math.floor(payroll.remaining/60)}:{String(payroll.remaining%60).padStart(2,'0')}</span>
  </HudHelp> : null;
}

function Payroll({state}:{state:HudModel['congress']}) {
  const {payroll} = useSyncExternalStore(state.subscribe,state.get);
  return <PayrollMetrics payroll={payroll}/>;
}

function HudPanel({children}:{children:ReactNode}) {
  return <aside className="react-agenda grid gap-3"
    aria-labelledby="agenda-title">{children}</aside>;
}

function AgendaPanel({state}:{state:HudModel['agenda']}) {
  const agenda = useSyncExternalStore(state.subscribe,state.get);
  if (!agenda) return null;
  return <HudPanel>
    <HudHelp as="header" help="Acompanhe suas missões e recompensas." className="flex items-center gap-3">
      <svg className="hud-glyph agenda-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M8 11h1m3 0h4m-8 4h1m3 0h4"/>
        <path d="M9 7V5a3 3 0 0 1 6 0v2Z"/>
      </svg>
      <h2 id="agenda-title">Agenda Pessoal</h2>
    </HudHelp>
    {agenda.recent.length>0 && <ul className="react-missions completed" aria-label="Conclusões recentes">
      {agenda.recent.map(mission=><MissionRow key={mission.id} mission={mission} done/>)}
    </ul>}
    <ul className="react-missions" aria-label="Objetivos ativos">
      {agenda.active.map(mission=><MissionRow key={mission.id} mission={mission}/>)}
    </ul>
    <span className="sr-only" role="status">{agenda.announcement}</span>
  </HudPanel>;
}

export function MissionRow({mission,done=false}:{mission:Mission;done?:boolean}) {
  const reward = missionReward(mission.kind);
  const timed = timedAgendas.has(mission.kind);
  const current = timed ? Math.floor(mission.current/1000) : mission.current;
  const target = timed ? mission.target/1000 : mission.target;
  const progress = (mission.kind==='fortuna' || mission.kind==='poupancaInstitucional' || mission.kind==='investimentoPolitico' || mission.kind==='ostentacao' || mission.kind==='reservaCofre' || mission.kind==='contribuinte') ? money(current)+' / '+money(target) :
    target>1 ? current+' / '+target+(timed ? ' s' : '') : '';
  return <HudHelp as="li" help="A missão mostra o objetivo, o progresso e os prêmios." className="flex items-start gap-2" data-done={done}>
    <span className="react-mission-check" aria-hidden="true">{done && <HudIcon name="check"/>}</span>
    <div className="min-w-0 flex-1">
      <strong>{missionTitle(mission)}</strong>
      <div className="react-mission-meta">
        <div className="react-mission-rewards" role="group" aria-label="Prêmios da missão">
          <span data-reward="xp">{reward.xp} XP</span>
          {!!reward.cash && <span data-reward="cash"><HudIcon name="wallet"/>{money(reward.cash)}</span>}
          {!!reward.popularity && <PopularityReward amount={reward.popularity}/>}
        </div>
        {!done && progress && <small>{progress}</small>}
      </div>
    </div>
  </HudHelp>;
}

function Vitals({profile,stamina}:{profile:HudModel['profile']; stamina:HudModel['stamina']}) {
  const stats = useSyncExternalStore(profile.subscribe,profile.get,profile.get);
  const energy = useSyncExternalStore(stamina.subscribe,stamina.get,stamina.get);
  if (!stats) return null;
  const earned = stats.xp-stats.start;
  const goal = stats.next===undefined ? 0 : stats.next-stats.start;
  return <div className="react-vitals grid gap-1.5">
    {stats.hp!==undefined && stats.maxHp!==undefined &&
      <HudHelp as="div" help="Sua vida atual. Ao zerar, você cai." className="vital-row" data-tone="health"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3.6 13A5.6 5.6 0 0 1 12 5.8 5.6 5.6 0 0 1 20.4 13Z"/></svg>
        <Meter label="PV" value={stats.hp} max={stats.maxHp} tone="health"/>
        <small>{stats.hp} / {stats.maxHp}</small>
      </HudHelp>}
    <HudHelp as="div" help="Sua energia para correr e usar ações físicas." className="vital-row" data-tone="stamina"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-2 8 11-13h-8l3-7Z"/></svg>
      <Meter label="Stamina" value={energy.current} max={energy.max} tone="stamina"/>
      <small>{energy.current} / {energy.max}</small>
    </HudHelp>
    <HudHelp as="div" help="Experiência acumulada até o próximo nível." className="vital-row" data-tone="xp"><span aria-hidden="true">XP</span>
      <Meter label="XP" value={goal ? earned : 1} max={goal || 1} tone="xp"/>
      <small>{goal ? `${earned} / ${goal}` : 'MAX'}</small>
    </HudHelp>
  </div>;
}

function ProfileResources({state}:{state:HudModel['resources']}) {
  const resources = useSyncExternalStore(state.subscribe,state.get,state.get);
  if (!resources) return null;
  return <div className="profile-resource-row">
    <HudHelp as="span" help="Apoio dos eleitores ao seu personagem."><HudIcon name="chart"/>Pop. <strong>{resources.popularity}</strong></HudHelp>
    <HudHelp as="span" help="Dinheiro disponível na sua carteira."><HudIcon name="wallet"/><strong>{money(resources.wallet)}</strong></HudHelp>
  </div>;
}

function Level({state}:{state:HudModel['profile']}) {
  const profile = useSyncExternalStore(state.subscribe,state.get,state.get);
  return profile && <HudHelp as="strong" help="Seu nível sobe quando você ganha experiência." className="react-level tabular-nums" aria-label={`Nível ${profile.level}`}>NV {profile.level}</HudHelp>;
}

export function CharacterProfile({model}:{model:HudModel}) {
  const person = useSyncExternalStore(model.character.subscribe,model.character.get,model.character.get);
  const {former,infiltrator,office} = useSyncExternalStore(model.mandate.subscribe,model.mandate.get,model.mandate.get);
  return <>
    <div className="profile-portrait">
      {person ? <HudHelp as="span" help="Retrato do personagem que você escolheu."><CharacterPortrait id="hud-portrait" character={person.character}/></HudHelp> : null}
      <ProfileReward state={model.profileReward}/>
    </div>
    <div className="deck-identity">
      <div className="profile-name-row">
        <HudHelp as="strong" help="Seu apelido nesta sessão." id="hud-nick">{person?.nick}</HudHelp>
        {infiltrator ? <HudHelp id="profile-role" className="resource-help profile-help" aria-label="Infiltrado"
          help="Infiltrado. Derrube a estabilidade."><HudIcon name="bug"/></HudHelp> : null}
        <span id="profile-level-mount"><Level state={model.profile}/></span>
      </div>
      <div className="profile-subtitle">
        <HudHelp as="small" help="Seu cargo atual no Congresso." id="hud-office">{former ? 'Ex-parlamentar' : 'Parlamentar'}</HudHelp>
        {office ? <HudHelp as="small" help="Número do seu gabinete no mapa." id="own-office">Gabinete {office.padStart(2,'0')}</HudHelp> : null}
      </div>
      <div id="profile-resources"><ProfileResources state={model.resources}/></div>
    </div>
    <div id="profile-vitals"><Vitals profile={model.profile} stamina={model.stamina}/></div>
  </>;
}

function ProfileReward({state}:{state:HudModel['profileReward']}) {
  const reward = useSyncExternalStore(state.subscribe,state.get,state.get);
  return <div id="profile-xp-reward" role="status">{reward}</div>;
}

function Broadcast({state}:{state:HudModel['broadcast']}) {
  const active = useSyncExternalStore(state.subscribe,state.get);
  return active && <HudHelp as="div" help="Sua voz está sendo transmitida pelo megafone." className="react-broadcast rounded-hud bg-hud-surface text-hud-ink" role="status">📣 Transmissão por Megafone</HudHelp>;
}

export function FireNotice({fire}:{fire:FireView}) {
  return <aside id={"active-fire-"+fire.site} className="incident-panel" aria-labelledby={"fire-title-"+fire.site} data-paused={fire.paused}>
    <HudHelp as="article" help="Use um extintor no local para combater o incêndio." className="incident-fire">
      <svg className="hud-glyph incident-flame" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 0 2-1 3-2 3 1-4-1-8-4-10 0 4-1 6-3 8a7 7 0 0 0 5 12Z"/>
        <path d="M12 22a3 3 0 0 0 3-3c0-2-2-3-3-5-1 2-3 3-3 5a3 3 0 0 0 3 3Z"/>
      </svg>
      <div><strong id={"fire-title-"+fire.site}>Incêndio</strong><small>{fireSites[fire.site].name} · {fireSites[fire.site].object}</small></div>
      <span className="incident-time">{fire.paused ? 'Pausado' : `${fire.remaining} s`}</span>
      {!fire.paused && <p><HudIcon name="shield"/>−{fire.damage} {fire.budget ? 'mil do orçamento' : 'de estabilidade'} a cada {fireRules.tick/1000} s</p>}
    </HudHelp>
  </aside>;
}

function PowerNotice({state}:{state:HudModel['outage']}) {
  const outage = useSyncExternalStore(state.subscribe,state.get);
  if (!outage) return null;
  const status = outage.paused ? 'Reparo pausado' : outage.seconds ? `Restabelecendo energia · ${outage.seconds} s` :
    outage.operating!==undefined ? 'Aguardando o outro painel. Permaneça no alcance.' : 'Dois jogadores devem operar os painéis juntos.';
  return <aside id="active-outage" className="incident-panel" aria-labelledby="outage-title" data-paused={outage.paused}>
    <HudHelp as="article" className="incident-fire" help="Dois jogadores precisam operar os painéis ao mesmo tempo.">
      <HudIcon name="alert"/>
      <div><strong id="outage-title">Pane elétrica</strong>
        {powerPanels.map(({name},index)=><small key={name}>{index===0 ? 'A' : 'B'} · {name} · {outage.occupied[index] ? 'Em uso' : 'Livre'}</small>)}
      </div>
      <p>{status}</p>
    </HudHelp>
  </aside>;
}

function GhostAdviserNotice({state}:{state:HudModel['ghostAdvisers']}) {
  const incident = useSyncExternalStore(state.subscribe,state.get);
  return <>{incident?.elimination && <div className="ghost-adviser-elimination" role="status"><strong>{incident.elimination.name}</strong> assassinou um gasto extra</div>}{!!incident?.count && <aside className="incident-panel" data-paused={incident.paused}>
    <article className="incident-fire"><div><strong>Assessores fantasmas: {incident.count}</strong>
    <small>Encontre e elimine com porrete.</small></div>
    <p>{incident.paused ? 'Pausado' : `−R$ ${incident.count} mil do orçamento a cada 6 s`}</p></article>
  </aside>}</>;
}

function ActiveFires({state}:{state:HudModel['fires']}) {
  const fires = useSyncExternalStore(state.subscribe,state.get);
  return fires && <div className="fire-notices">{fires.map(active=><FireNotice key={active.site} fire={active}/>)}</div>;
}

export function TelevisionNotice({name,remaining}:{name:string;remaining:number}) {
  return <HudHelp as="aside" help="Tempo restante da entrevista eleitoral ao vivo." id="electoral-notice" className="hud-strip" role="status">
    TV ao vivo: {name} · {remaining}s
  </HudHelp>;
}

function LiveTelevision({state}:{state:HudModel['television']}) {
  const interview = useSyncExternalStore(state.subscribe,state.get);
  return interview && <TelevisionNotice {...interview}/>;
}

export function PlenarySettingsButton({open}:{open:()=>void}) {
  const {label,key,icon} = settingsApp;
  return <HudHelp id="plenary-settings" className="hud-icon-button" help="Ajuste som e preferências da sessão. (K)"
    aria-label={label} aria-keyshortcuts={key} onClick={open}>
    <HudIcon name={icon}/>
  </HudHelp>;
}

export function mountReactHud(openSettings:()=>void) {
  const model = createHudModel();
  const {broadcast,congress,agenda} = model;
  const televisionRoot = createRoot(document.getElementById('electoral-notice-mount')!);
  televisionRoot.render(<LiveTelevision state={model.television}/>);
  const fireRoot = createRoot(document.getElementById('active-fire-mount')!);
  fireRoot.render(<><GhostAdviserNotice state={model.ghostAdvisers}/><ActiveFires state={model.fires}/></>);
  const outageRoot = createRoot(document.getElementById('active-outage-mount')!);
  outageRoot.render(<PowerNotice state={model.outage}/>);
  const broadcastRoot = createRoot(document.getElementById('megaphone-status')!);
  broadcastRoot.render(<Broadcast state={broadcast}/>);
  const profileRoot = createRoot(document.getElementById('profile-dock')!);
  profileRoot.render(<CharacterProfile model={model}/>);
  const parliamentRoot = createRoot(document.getElementById('congress-dock')!);
  const payrollRoot = createRoot(document.getElementById('payroll-mount')!);
  payrollRoot.render(<Payroll state={congress}/>);
  const agendaDock = document.getElementById('agenda-dock')!;
  const agendaRoot = createRoot(agendaDock);
  const session = document.getElementById('session')!;
  const equipment = session.querySelector('.character-dock')!;
  const positionAgenda = ()=>{
    const top = equipment.getBoundingClientRect().bottom;
    const available = Math.max(0,agendaDock.getBoundingClientRect().bottom-top-20);
    agendaDock.style.setProperty('--agenda-available-height',`${available}px`);
    agendaDock.dataset.scrollable = String(agendaDock.scrollHeight>agendaDock.clientHeight+1);
  };
  const agendaLayout = new ResizeObserver(positionAgenda);
  agendaLayout.observe(session);
  agendaLayout.observe(equipment);
  agendaLayout.observe(agendaDock);
  parliamentRoot.render(<><Parliament state={congress} countdown={model.countdown}/><PlenarySettingsButton open={openSettings}/></>);
  agendaRoot.render(<><AutomaticProjectsHud channel={model.automaticProjects}/><AgendaPanel state={agenda}/></>);
  return {
    broadcast: broadcast.update,
    player: model.player,
    profileReward:model.profileReward.update,
    render: model.render,
    destroy() { agendaLayout.disconnect(); payrollRoot.unmount(); televisionRoot.unmount(); fireRoot.unmount(); outageRoot.unmount(); broadcastRoot.unmount(); parliamentRoot.unmount(); agendaRoot.unmount(); profileRoot.unmount(); },
  };
}
