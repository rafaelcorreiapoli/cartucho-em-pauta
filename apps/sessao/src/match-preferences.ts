import {caloteDebtSecondsOptions} from './game-modes';
import {npcRules} from './visitors';

const storageKey = 'cartuchao.sessao.match-settings';
const choices:Record<string,{field:string;values:readonly unknown[]}> = {
  'lobby-game-mode':{field:'mode',values:['classic','calote']},
  'lobby-initial-wallet':{field:'value',values:[0,20,50]},
  'lobby-initial-budget':{field:'value',values:[-5,0,5]},
  'lobby-match-minutes':{field:'value',values:[12,15,20]},
  'lobby-calote-debt-seconds':{field:'value',values:caloteDebtSecondsOptions},
  'lobby-npc-count':{field:'count',values:[0,1,2,3,npcRules.maxCount]},
  infiltrators:{field:'count',values:[1,2]},
};
for (const name of ['grants','automatic-projects','portraits-vip','decorations','surveillance','photos','elections','project-voting','federal-patrol','phone-games']) {
  choices['lobby-'+name] = {field:'enabled',values:[false,true]};
}

export function readMatchPreferences():Record<string,Record<string,unknown>> {
  try {
    const saved:unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    if (!saved || typeof saved!=='object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(choices).flatMap(([channel,{field,values}])=>{
      const entry = (saved as Record<string,unknown>)[channel];
      const value = entry && typeof entry==='object' ? (entry as Record<string,unknown>)[field] : undefined;
      return values.includes(value) ? [[channel,{[field]:value}]] : [];
    }));
  } catch { return {}; }
}

export function saveMatchPreference(channel:string,command:unknown) {
  const choice = choices[channel];
  if (!choice || !command || typeof command!=='object') return;
  const value = (command as Record<string,unknown>)[choice.field];
  if (!choice.values.includes(value)) return;
  try {
    localStorage.setItem(storageKey,JSON.stringify({...readMatchPreferences(),[channel]:{[choice.field]:value}}));
  } catch {}
}
