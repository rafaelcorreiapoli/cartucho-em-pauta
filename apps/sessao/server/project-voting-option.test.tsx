import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from './PlenaryMatch';
import {PersonalAgenda} from './PersonalAgenda';
import {Gameplay} from './Gameplay';
import {NpcDialogues} from './NpcDialogues';
import {PoliticalEconomy} from './PoliticalEconomy';
import {npcEnabled,npcs,cassationFee} from '../src/npcs';
import {CASSATION_NOTICE_MS,projectRules,stations} from '../src/plenary';
import {HEARING_MS} from '../src/politics';
import {PhoneApps} from '../src/ui/phone-apps';
import {LegislativeDock} from '../src/plenary-panel';
import {stationShortcuts} from '../src/ui/station-shortcuts';
import type {Player} from '../src/map';
import type {GameplayWorld} from './gameplay-world';

const players:Player[] = ['a','b','c'].map((id,character)=>({id,nick:id,character,x:140+36*character,y:146,direction:0,moving:false}));
const ids = players.map(player=>player.id);
const metrics = {wallet:8,popularity:40};

test('disabled projects and document missions stay out of every initial and replacement deck',()=>{
  const blocked = ['protocolo','assinaturas','assinar','comissaoImprovisada','assinaturaAlvo','documentoAlvo','provaDocumental','retratacaoOficial','votoNpc','apoio','projetos','oposicao','leitura','votacao'];
  for (let seed=0;seed<100;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),true,false);
    expect(agenda.view(metrics).active.some(({kind})=>blocked.includes(kind))).toBe(false);
    expect((Reflect.get(agenda,'missionDeck') as string[]).some(kind=>blocked.includes(kind))).toBe(false);
  }
});

test('disabled clerks are absent from the map predicate, nearby interactions and direct conversations',()=>{
  const dialogues = new NpcDialogues();
  dialogues.projectVotingEnabled = false;
  for (const id of ['secretary','protocol'] as const) {
    const player = {...players[0],...npcs[id].interaction};
    expect(npcEnabled(id,false)).toBe(false);
    expect(npcEnabled(id,true)).toBe(true);
    expect(dialogues.nearbyNpcs(player)).not.toContain(id);
    expect(dialogues.open(player,id)).toBe('Aproxime-se para conversar.');
    expect(dialogues.view(player,()=>true,[])).toBeUndefined();
  }
  expect(npcEnabled('corregedor',false)).toBe(true);
  const player = {...players[0],...npcs.corregedor.interaction};
  expect(dialogues.nearbyNpcs(player)).toContain('corregedor');
});

test('disabled documents reject stale or crafted gameplay requests',()=>{
  const game = new Gameplay();
  game.projectVotingEnabled = false;
  for (const action of [{kind:'supply',place:'secretary',target:'project-0'},
    {kind:'supply',place:'secretary',target:'queue'},
    {kind:'edit'},{kind:'stamp'},{kind:'verify-document'},{kind:'shop-buy',target:'forensicKit'}] as const) {
    expect(game.act(players[0],action,{} as GameplayWorld)).toBe('Documentos e projetos desativados nesta partida.');
  }
});

test('disabled projects cannot be filed or scheduled and disappear from HUD and phone',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(ids[0],players,0,()=>.9,1,false,true,false)).toBe(true);
  const world = match.gameplayWorld(players,0,()=>false);
  expect(world.projectFilingError?.(ids[0],0)).toContain('desativadas');
  expect(world.publish({type:'filed',actor:ids[0],project:0,at:0,position:players[0],witnesses:[]})).toBe(false);
  match.advance(projectRules.debateMs+1);
  const view = match.view(ids[0],ids,projectRules.debateMs+1);
  expect(view.phase).toBe('negotiation');
  expect(view.project).toBeUndefined();
  expect(match.negotiableProject(1)).toBeUndefined();
  expect(renderToStaticMarkup(<LegislativeDock view={view} id={ids[0]} command={()=>{}}/>)).toBe('');
  const phone = renderToStaticMarkup(<PhoneApps projectsEnabled={false} select={()=>{}}/>);
  expect(phone).not.toContain('Projetos');
  expect(phone).toContain('Joguinhos');
  expect(stationShortcuts(view,players[0],'library')).toEqual([]);
});

test.each([true,false])('cassation still works without projects, elections=%s',(electionsEnabled)=>{
  const match = new PlenaryMatch(1);
  match.start(ids[0],players,0,()=>.9,1,false,true,false,electionsEnabled);
  (Reflect.get(match,'economy') as PoliticalEconomy).earn(ids[0],cassationFee);
  expect(match.callCassation({...players[0],...stations.audit},50)).toBeUndefined();
  const open = 50+CASSATION_NOTICE_MS;
  match.advance(open);
  const view = match.view(ids[0],ids,open);
  expect(view.cassation).toBeDefined();
  const html = renderToStaticMarkup(<LegislativeDock view={view} id={ids[0]} command={()=>{}}/>);
  expect(html).toContain('cassation');
  expect(html).not.toContain('project-details');
  match.castCassation(ids[0],ids[1],open);
  match.castCassation(ids[1],ids[2],open);
  match.castCassation(ids[2],null,open);
  match.advance(open+HEARING_MS);
  expect(match.view(ids[0],ids,open+HEARING_MS).phase).toBe('negotiation');
});
