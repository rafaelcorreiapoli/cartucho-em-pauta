import {HudHelp} from './hud-help';
import {documentRules} from '../internal-mail';
import {npcRules} from '../parliamentarians';
import type {PlenaryView} from '../plenary';

export function contextProgress(view:PlenaryView|undefined) {
  const state = view?.gameplay;
  const channel = state?.officeChannel;
  const fire = view?.fireInteraction;
  const installation = state?.installationProgress;
  const breach = channel && channel.kind!=='office-cash' ? channel : undefined;
  const robbery = state?.robberyProgress;
  const spy = state?.surveillance;
  return fire?.progress!==undefined ? {value:fire.progress,max:1,label:'Instalando dispositivo',detail:'Instalando dispositivo'} :
    installation ? {value:installation.elapsed,max:installation.duration,label:'Instalando decoração',detail:'Instalando decoração'} :
    state?.forgeryRemaining!==undefined ? {value:documentRules.forgeryMs-state.forgeryRemaining,max:documentRules.forgeryMs,label:'Adulterando documento',
    detail:`Adulterando documento · ${Math.ceil(state.forgeryRemaining/1000)} s`} : channel?.kind==='office-cash' ? {value:channel.elapsed,max:channel.duration,label:'Embolsando dinheiro'} : breach ? {value:breach.elapsed,max:breach.duration,label:breach.label,
    detail:`${breach.label} · ${Math.ceil((breach.duration-breach.elapsed)/1000)} s`} :
    robbery!==undefined ? {value:robbery,max:npcRules.robberyMs,label:'Roubando dinheiro'} :
    spy?.progress!==undefined ? {value:spy.progress,max:1,label:'Interação de espionagem em andamento'} : undefined;
}

export function ContextProgress({meter}:{meter:NonNullable<ReturnType<typeof contextProgress>>}) {
  return <>
    {meter.detail && <span id="office-progress-label">{meter.detail}</span>}
    <HudHelp as="div" help="A barra mostra quanto falta para concluir a ação." id="office-progress" className="react-meter" data-tone="budget" role="progressbar"
      aria-label={meter.label} aria-valuenow={meter.value} aria-valuemin={0} aria-valuemax={meter.max}>
      <span style={{transform:`scaleX(${Math.max(0,Math.min(1,meter.value/meter.max))})`}}/>
    </HudHelp>
  </>;
}
