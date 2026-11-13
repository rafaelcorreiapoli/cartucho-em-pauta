import { installationSites } from '../src/installations';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { PersonalAgenda } from './PersonalAgenda';
import { PoliticalEconomy } from './PoliticalEconomy';
import type { GameplayWorld } from './gameplay-world';
import { terminals, type GameplayEvent } from '../src/gameplay';
import type { Player } from '../src/map';
import { npcs } from '../src/npcs';

const metrics = {wallet:8,popularity:40};

function event(type:GameplayEvent['type'], extra:Partial<GameplayEvent> = {}):GameplayEvent {
  return {type,actor:'a',at:1,position:{x:0,y:0},witnesses:[],...extra};
}

test('two different signers must sign the same document after assignment',()=>{
  const economy = new PoliticalEconomy();
  const players:Player[] = ['a','b','c'].map((id,index)=>({
    ...terminals.secretary.point,x:terminals.secretary.point.x+index*8,
    id,nick:id,moving:false,direction:0,character:index,
  }));
  const [owner,b,c] = players;
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>.09);
  const view = (id:string) => economy.view(id,[],0,false,()=>true)!;
  expect(view(owner.id).missions.active.some(mission=>mission.kind==='assinaturas')).toBe(true);

  const game = new Gameplay();
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},publish:entry=>economy.recordGameplay(entry)};
  game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world);
  const [document] = game.view(owner,world).inventory;
  const sign = (signer:Player) => {
    game.act(owner,{kind:'sign-request',target:signer.id,item:document.id},world);
    const [request] = game.view(signer,world).requests;
    game.act(signer,{kind:'accept',item:request.id},world);
    game.act(signer,{kind:'accept',item:request.id},world);
  };
  sign(b);
  economy.recordGameplay(event('signed',{actor:c.id,target:owner.id,item:document.id+100}));
  expect(view(owner.id).missions.active.find(mission=>mission.kind==='assinaturas')?.current).toBe(1);
  sign(c);
  expect(view(owner.id)).toMatchObject({wallet:10,missions:{completed:[{kind:'assinaturas'}]}});
  expect(view(owner.id).missions.active).toHaveLength(3);
  expect(view(b.id).missions.completed).toEqual([]);
});

test('a real pizza purchase and consumption produce different agenda results',()=>{
  const economy = new PoliticalEconomy();
  const player:Player = {...npcs.snackVendor.interaction,id:'a',nick:'A',direction:0,moving:false,character:0};
  const game = new Gameplay();
  economy.reset([{id:'a',name:'A'}],()=>0);
  const view = () => economy.view('a',[],0,false,()=>true)!;
  const world:GameplayWorld = {players:[player],now:1,voice:()=>true,office:()=>undefined,
    earn:()=>{},spend:(id,price)=>economy.spend(id,price),publish:entry=>economy.recordGameplay(entry)};
  game.act(player,{kind:'talk',target:'snackVendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'pizza',token:game.view(player,world).dialogue?.token},world);
  expect(view().missions.completed).toEqual([]);
  const [pizza] = game.view(player,world).inventory;
  game.act(player,{kind:'use',item:pizza.id},world);
  expect(view()).toMatchObject({wallet:6,walletIncome:0,progression:{xp:20},missions:{completed:[{kind:'pizza'}]}});
  expect(view().missions.active).toHaveLength(3);
});

test('hidden play counts only witnessed-free gameplay time and duplicate samples do not count',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  // Advance the real deck without mutating active objectives directly.
  agenda.progress(metrics,{cafe:1,protocolo:1,pizza:1});
  while (!agenda.hasActive('jogarOculto')) {
    const active = agenda.view(metrics).active;
    if (active.some(mission=>mission.id>60)) throw new Error('Hidden play did not become eligible');
    agenda.progress(metrics,Object.fromEntries(active.map(mission=>[mission.kind,mission.target])));
  }
  const hidden = () => agenda.view(metrics).active.find(mission=>mission.kind==='jogarOculto');
  agenda.recordGameplay(metrics,event('game-played',{at:2,duration:100,witnesses:['b']}),false);
  expect(hidden()?.current).toBe(0);
  for (let i=0;i<300;i++) {
    const sample = event('game-played',{at:3+i*100,duration:100});
    agenda.recordGameplay(metrics,sample,false);
    agenda.recordGameplay(metrics,sample,false);
    if (i===149) expect(hidden()?.current).toBe(15_000);
  }
  expect(agenda.view(metrics).completed.at(-1)?.kind).toBe('jogarOculto');
  expect(agenda.view(metrics).active).toHaveLength(3);
  expect(hidden()).toBeUndefined();
});

test('the phone only emits play time after input and uses observer visibility through walls',()=>{
  const player:Player = {id:'a',nick:'A',x:130,y:60,direction:0,moving:false,character:0};
  const observer:Player = {...player,id:'b',x:158};
  const samples:GameplayEvent[] = [];
  const world:GameplayWorld = {players:[player,observer],now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},hasMission:()=>true,publish:entry=>{if (entry.type==='game-played') samples.push(entry);}};
  const game = new Gameplay();
  game.act(player,{kind:'game-start'},world);
  world.now = 100;
  game.tick(world,true);
  expect(samples).toEqual([]);
  game.act(player,{kind:'game-turn',direction:'right'},world);
  world.now = 150;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:[]});
  observer.x = 108;
  world.now = 200;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:['b']});
});

test.each(['documentoAlvo','pizzaAlvo','dinheiroAlvo','visitaAlvo','selfieAlvo'] as const)(
  '%s completes only after the corresponding gameplay with the assigned person',
  kind=>{
    const economy = new PoliticalEconomy();
    const players:Player[] = ['a','b','c'].map((id,character)=>({
      id,nick:character===0 ? 'Autora' : 'Mesmo nome',character,x:140,y:146,direction:0,moving:false,
    }));
    const [owner,target,other] = players;
    economy.reset(players.map(({id,nick:name,character})=>({id,name,character})),()=>0);
    const agenda = Reflect.get(economy,'accounts').get(owner.id).agenda as PersonalAgenda;
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    const missions = () => economy.view(owner.id,[],0,false,()=>true)!.missions;
    expect(missions().active.find(mission=>mission.kind===kind)?.person?.id).toBe(target.id);

    const game = new Gameplay();
    game.reset(0,()=>.5,players,()=>.5);
    const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
      spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
    const interact = (recipient:Player) => {
      const third = recipient===target ? other : target;
      Object.assign(third,{x:800,y:490});
      world.now += 3_000;
      if (kind==='dinheiroAlvo') {
        expect(economy.transfer(owner.id,recipient.id,3,true,0)).toBe(true);
        return;
      }
      if (kind==='visitaAlvo') {
        Object.assign(owner,{x:140,y:146});
        game.tick(world,true);
        Object.assign(owner,game.officeSpawn(recipient.id));
        game.tick(world,true);
        return;
      }
      if (kind==='selfieAlvo') {
        Object.assign(owner,{x:140,y:146});
        Object.assign(recipient,{x:148,y:146});
        expect(game.act(owner,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
        return;
      }
      if (kind==='documentoAlvo') {
        Object.assign(owner,terminals.secretary.point);
        game.act(owner,{kind:'supply',place:'secretary'},world);
      } else {
        Object.assign(owner,npcs.snackVendor.interaction);
        game.act(owner,{kind:'talk',target:'snackVendor'},world);
        game.act(owner,{kind:'dialogue-choice',target:'products',token:game.view(owner,world).dialogue?.token},world);
        game.act(owner,{kind:'shop-buy',target:'pizza',token:game.view(owner,world).dialogue?.token},world);
      }
      Object.assign(owner,{x:140,y:146});
      Object.assign(recipient,{x:148,y:146});
      const item = game.view(owner,world).inventory.find(item=>item.kind===(kind==='pizzaAlvo' ? 'pizza' : 'document'))!;
      game.act(owner,{kind:'offer',target:recipient.id,item:item.id},world);
      const request = game.view(recipient,world).requests.find(request=>request.item.id===item.id)!;
      game.act(recipient,{kind:'accept',item:request.id},world);
      expect(game.view(recipient,world).inventory.some(entry=>entry.id===item.id)).toBe(true);
    };
    interact(other);
    expect(missions().completed.some(mission=>mission.kind===kind)).toBe(false);
    interact(target);
    expect(missions().completed.find(mission=>mission.kind===kind)?.person?.id).toBe(target.id);
    expect(missions().active).toHaveLength(3);
  },
);

test('a player in isolation is replaced as a selfie target while their office remains visitable',()=>{
  const targets = [{id:'b',name:'Bia'},{id:'c',name:'Caio'}];
  for (const kind of ['selfieAlvo','visitaAlvo'] as const) {
    const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio']);
    agenda.updateEligibility(metrics,3,true,3,0,targets,new Set(['b','c']));
    const target = () => agenda.view(metrics).active.find(mission=>mission.kind===kind)?.person?.id;
    expect(target()).toBe('b');
    agenda.updateEligibility(metrics,3,true,3,0,targets,new Set(['c']));
    expect(target()).toBe(kind==='selfieAlvo' ? 'c' : 'b');
  }
});

test('mission draws skip unavailable offices, exhausted purchases and unaffordable objectives',()=>{
  const metrics = {wallet:0,popularity:40};
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['presidenteFoto','protocolo','comprarLagosta','televisao','cafe','passeio','selfieSolo']);
  agenda.recordGameplay(metrics,event('purchased',{kind:'officeTv'}),false);
  // Keep the deck fixed so changes to the account are the only eligibility inputs.
  Reflect.set(agenda,'missions',[]);
  agenda.updateEligibility(metrics,3,false,3);
  expect(agenda.view(metrics).active.map(mission=>mission.kind).sort()).toEqual(['cafe','passeio','selfieSolo']);
  Reflect.set(agenda,'missions',[]);
  metrics.wallet = 6;
  agenda.updateEligibility(metrics,3,true,3);
  const eligible = agenda.view(metrics).active.map(mission=>mission.kind);
  expect(eligible).toContain('comprarLagosta');
  expect(eligible).toContain('protocolo');
  expect(eligible).not.toContain('televisao');
});

test('a carried pizza is an alternative to the purchase cost when drawing a mission',()=>{
  const id = 'a';
  const player:Player = {id,nick:'A',character:0,direction:0,moving:false,...npcs.snackVendor.interaction};
  const economy = new PoliticalEconomy();
  economy.reset([{id,name:'A',character:0}],()=>0);
  const game = new Gameplay();
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind));
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  game.act(player,{kind:'talk',target:'snackVendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'pizza',token:game.view(player,world).dialogue?.token},world);
  const pizza = game.view(player,world).inventory.find(item=>item.kind==='pizza')!;
  expect(economy.spend(id,6)).toBe(true);
  const account = Reflect.get(economy,'accounts').get(id);
  const active = () => economy.view(id,[],0,false,()=>true)!.missions.active;
  const draw = () => {
    Reflect.set(account.agenda,'missions',[]);
    Reflect.set(account.agenda,'missionDeck',['pizza','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([id]),3);
  };
  draw();
  expect(active().some(mission=>mission.kind==='pizza')).toBe(true);
  game.act(player,{kind:'drop',item:pizza.id},world);
  draw();
  expect(active().some(mission=>mission.kind==='pizza')).toBe(false);
});

test('the scandal pizza mission becomes eligible only after a public finding',()=>{
  const economy = new PoliticalEconomy();
  const ids = ['a','b','c','d'];
  economy.reset(ids.map(id=>({id,name:id,character:0})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(ids),3);
    return economy.view('a',[],0,false,()=>true)!.missions.active.some(mission=>mission.kind==='pizzada');
  };
  expect(draw()).toBe(false);
  economy.recordOfficialScandal();
  expect(draw()).toBe(true);
});

test('furniture missions use the actual cabinet slots and prices at assignment',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,x:npcs.vendor.x,y:npcs.vendor.y+11};
  const game = new Gameplay();
  game.reset(0,()=>0,[player]);
  const economy = new PoliticalEconomy();
  economy.reset([{id:player.id,name:player.nick}],()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),id=>game.officeStock(id));
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['ostentacao','gabinete','televisao','poltrona','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([player.id]),3);
    return economy.view(player.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  const buy = (target:string) => {
    game.act(player,{kind:'talk',target:'vendor'},world);
    game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
    expect(game.act(player,{kind:'shop-buy',target,token:game.view(player,world).dialogue?.token},world)).toBe('Compra instalada no seu gabinete.');
  };

  expect(draw()).toContain('ostentacao');
  buy('officeTv');
  const afterTv = draw();
  expect(afterTv).not.toContain('ostentacao');
  expect(afterTv).not.toContain('televisao');
  expect(afterTv).toContain('gabinete');
  buy('officeRug');
  buy('officeChair');
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);
});

test('decoration missions require enough money or an item already in the inventory',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...terminals.credentials.point};
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  economy.reset([{id:player.id,name:player.nick}],()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind));
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['retrato','reserva','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([player.id]),3);
    return economy.view(player.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  expect(draw()).toContain('reserva');
  expect(game.act(player,{kind:'buy',target:'portrait'},world)).toContain('inventário');
  expect(economy.spend(player.id,6)).toBe(true);
  expect(draw()).toEqual(['retrato','cafe','passeio']);
  const portrait = game.view(player,world).inventory.find(item=>item.kind==='portrait')!;
  Object.assign(player,installationSites.hall.point);
  expect(game.act(player,{kind:'install',place:'hall',item:portrait.id},world)).toBe('Objeto instalado.');
  expect(economy.view(player.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='retrato')).toBe(true);
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);
});

test('collective missions wait for enough available players while office visits remain eligible',()=>{
  const economy = new PoliticalEconomy();
  const ids = ['a','b','c','d'];
  economy.reset(ids.map(id=>({id,name:id})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  economy.suspend('d',1000);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfie','entrega','visitaGabinete','cafe','passeio']);
  const draw = () => economy.updateAgendaEligibility(new Set(ids),3);
  const active = () => economy.view('a',[],0,false,()=>true)!.missions.active;
  draw();
  expect(active().map(mission=>mission.kind)).toEqual(['visitaGabinete','cafe','passeio']);

  economy.expireSuspensions(1000);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfie','entrega','visitaGabinete','cafe','passeio']);
  draw();
  const selfie = active().find(mission=>mission.kind==='selfie')!;
  expect(selfie).toBeDefined();
  economy.suspend('d',2000);
  draw();
  expect(active()).toContainEqual(selfie);
});

test('photo missions use live portrait and VIP installations when drawing',()=>{
  const players:Player[] = ['a','b','c'].map(id=>({id,nick:id,character:0,direction:0,moving:false,...terminals.credentials.point}));
  const [owner,colleague] = players;
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,(id,kind,replacement)=>game.hasAgendaDecoration(id,kind,replacement));
  const {agenda} = Reflect.get(economy,'accounts').get(owner.id);
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = (replacement=false) => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',replacement ? ['reforma','mandaVip','cafe','passeio','selfieSolo'] : ['autorretrato','fiscalVip','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    return economy.view(owner.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  const install = (player:Player, place:'hall'|'coffeeVip') => {
    const {kind,point} = installationSites[place];
    expect(game.act(player,{kind:'buy',target:kind},world)).toContain('inventário');
    const item = game.view(player,world).inventory.find(item=>item.kind===kind)!;
    Object.assign(player,point);
    expect(game.act(player,{kind:'install',place,item:item.id},world)).toBe('Objeto instalado.');
  };

  expect(draw()).toContain('autorretrato');
  expect(draw()).not.toContain('fiscalVip');
  expect(draw(true)).toEqual(['cafe','passeio','selfieSolo']);
  install(owner,'hall');
  expect(economy.spend(owner.id,6)).toBe(true);
  install(colleague,'coffeeVip');
  expect(draw()).toEqual(['autorretrato','fiscalVip','cafe']);
  expect(game.act(owner,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='autorretrato')).toBe(true);
  expect(economy.transfer(colleague.id,owner.id,1,false,0)).toBe(true);
  expect(draw(true)).toContain('mandaVip');
  expect(draw(true)).not.toContain('reforma');
  Object.assign(owner,installationSites.coffeeVip.point);
  const vip = game.view(owner,world).interactive.find(item=>item.kind==='vip')!;
  expect(game.act(owner,{kind:'uninstall',item:vip.id},world)).toBe('Objeto retirado.');
  expect(draw(true)).toContain('mandaVip');
  expect(game.act(owner,{kind:'install',place:'coffeeVip',item:vip.id},world)).toBe('Objeto instalado.');
  expect(economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='mandaVip')).toBe(true);
  expect(draw(true)).not.toContain('mandaVip');
});

test('transfer missions wait until the payment quota renews even when the wallet has funds',()=>{
  const economy = new PoliticalEconomy();
  const ids = new Set(['a','b']);
  economy.reset([...ids].map(id=>({id,name:id})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const view = (round:number) => economy.view('a',[],round,false,()=>true)!;
  const limit = view(0).paymentsLeft;
  for (let i=0;i<limit;i++) {
    expect(economy.transfer('a','b',1,false,0)).toBe(true);
    expect(economy.transfer('b','a',1,false,0)).toBe(true);
  }
  const draw = (round:number) => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pagamento','dinheiroAlvo','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3,()=>true,round);
    return view(round).missions.active.map(mission=>mission.kind);
  };
  expect(view(0)).toMatchObject({wallet:8,paymentsLeft:0});
  expect(draw(0)).toEqual(['cafe','passeio','selfieSolo']);
  expect(draw(1)).toEqual(['pagamento','dinheiroAlvo','cafe']);
  expect(economy.transfer('a','b',3,false,1)).toBe(true);
  expect(view(1).missions.completed.map(mission=>mission.kind)).toEqual(['pagamento','dinheiroAlvo']);
});
