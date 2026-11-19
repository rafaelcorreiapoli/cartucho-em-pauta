import type {PlenaryView} from './plenary';

export const settingsApp = {id:'settings',label:'Configurações',help:'Ajuste som e preferências da sessão.',icon:'settings',key:'K'} as const;

export const apps = [
  {id:'equipment',label:'Equipamentos',help:'Veja e troque os itens equipados.',icon:'inventory',key:'E'},
  {id:'attributes',label:'Personagem',help:'Distribua seus pontos de atributo.',icon:'chart',key:'P'},
  {id:'phone',label:'Celular',help:'Faça ligações, tire fotos e envie Pix.',icon:'phone',key:'C'},
  {id:'surveillance',label:'Vigilância',help:'Acesse suas câmeras e escutas.',icon:'camera',key:'V'},
  {id:'microphone',label:'Microfone',help:'Ajuste seu microfone para falar no jogo.',icon:'mic',key:'M'},
  settingsApp,
] as const;

export type HudApp = typeof apps[number]['id']|'bag';
export type HudAppStatus = Partial<Record<HudApp,{badge?:string}>>;
export type LaunchHudApp = (app:HudApp)=>boolean;

export function appForKey(key:string):HudApp|undefined {
  if (key==='o') return 'bag';
  if (key==='i') return 'attributes';
  return apps.find(app=>app.key.toLowerCase()===key)?.id;
}

export function hudAppStatus(view:PlenaryView,ready:boolean):HudAppStatus {
  if (!ready || view.phase==='lobby') return {};
  const status:HudAppStatus = {settings:{},microphone:{}};
  const {gameplay,politics} = view;
  if (gameplay) {
    status.equipment = {};
    status.phone = {};
    status.bag = {};
  }
  if (politics?.progression && view.phase!=='finished') {
    status.attributes = {badge:String(politics.progression.available || '')};
  }
  if (view.surveillanceEnabled!==false && gameplay?.surveillance) {
    const active = gameplay.surveillance.channels.filter(channel=>channel.active).length;
    status.surveillance = {badge:String(active || '')};
  }
  return status;
}

export function launchHudApp(status:HudAppStatus, commands:Record<HudApp,()=>void>, app:HudApp) {
  if (!status[app]) return false;
  commands[app]();
  return true;
}
