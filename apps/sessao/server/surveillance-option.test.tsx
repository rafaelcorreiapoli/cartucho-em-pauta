import {expect,test} from 'bun:test';
import {Gameplay} from './Gameplay';
import {PersonalAgenda} from './PersonalAgenda';
import {PlenaryMatch} from './PlenaryMatch';
import {hudAppStatus} from '../src/hud-apps';
import {fieldActions} from '../src/ui/field-actions';
import type {Player} from '../src/map';
import type {GameplayWorld} from './gameplay-world';

const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
const metrics = {wallet:8,popularity:40};

test('disabled surveillance removes its missions but keeps phone photography and X-ray missions',()=>{
  const blocked = ['varredura','limpeza','escutaAtiva','instalarGrampo','vigilanciaInstitucional','duasCameras','instalarCamera','cameraGabinete'];
  for (let seed=0;seed<100;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),true,true,true,true,false);
    expect(agenda.view(metrics).active.some(({kind})=>blocked.includes(kind))).toBe(false);
    const deck = Reflect.get(agenda,'missionDeck') as string[];
    expect(deck.some(kind=>blocked.includes(kind))).toBe(false);
    expect(deck).toContain('fotografia');
    expect(deck).toContain('fiscalizacaoParalela');
    expect(deck).toContain('patrimonioSuspeito');
  }
});

test('disabled surveillance rejects all spy commands and related purchases without opening channels',()=>{
  const game = new Gameplay();
  game.surveillanceEnabled = false;
  const world = {} as GameplayWorld;
  for (const kind of ['install','inspect','remove','recover','open','capture','rename','mute','alerts'] as const) {
    expect(game.spyAction(player,{kind,site:'coffee',channel:1},world)).toBe('Vigilância desativada nesta partida.');
  }
  for (const target of ['wiretap','spyCamera','bugDetector']) expect(game.act(player,{kind:'shop-buy',target},world)).toBe('Vigilância desativada nesta partida.');
  expect(game.spyView(player,world)).toEqual({channels:[],options:[],muted:false});
  expect(game.spyFrame(player,world)).toBeUndefined();
  expect(game.spyVolume(player,{...player,id:'b'})).toBe(0);
});

test('disabled surveillance hides its launcher and security actions while phone photos still work',()=>{
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.9,1,false,true,true,true,true,false);
  const view = match.view(player.id,[player.id],1);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  game.surveillanceEnabled = false;
  const world = match.gameplayWorld([player],1,()=>false);
  view.gameplay = game.view(player,world);
  // A stale snapshot must not re-enable the disabled interfaces.
  view.gameplay.surveillance = {channels:[],options:[],muted:false};
  view.gameplay.security = {};
  expect(hudAppStatus(view,true).surveillance).toBeUndefined();
  expect(fieldActions(view,player,[player]).some(({action})=>action.kind==='open-security')).toBe(false);
  expect(game.act(player,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(game.photoView(player.id,1).album).toHaveLength(1);
});
