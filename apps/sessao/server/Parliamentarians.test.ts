import { npcs } from '../src/npcs';
import { expect,test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { Parliamentarians } from './Parliamentarians';
import { ParliamentarianTalk } from './ParliamentarianTalk';
import { PlenaryMatch } from './PlenaryMatch';
import { npcRules } from '../src/parliamentarians';
import { canStand, type Player } from '../src/map';
import { BALLOT_MS, NEGOTIATION_MS } from '../src/plenary';
import { terminals } from '../src/gameplay';
import { privateOffices, officeRules } from '../src/private-offices';
import { ELECTION_RULES } from '../src/elections';

function fixture() {
  const humans:Player[] = ['a','b'].map(id=>({id,nick:id,character:0,direction:0,moving:false,x:140,y:146}));
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  const members = new Parliamentarians();
  match.start('a',humans,0,()=>0);
  game.reset(0,()=>0,humans,()=>0);
  members.reset(2,0);
  const npcs = members.players;
  for (const npc of npcs) match.addParliamentarian(npc);
  match.refreshAgendaEligibility();
  const talk = new ParliamentarianTalk(members,game,match);
  const world = (now:number)=>match.gameplayWorld([...humans,...npcs],now,()=>false);
  return {humans,match,game,members,npcs,talk,world};
}

test('signature and competing vote offers transfer existing money and the commitment survives robbery',()=>{
  const {humans:[a,b],npcs:[,npc],game,match,members,talk,world} = fixture();
  Object.assign(a,terminals.secretary.point);
  Object.assign(npc,{x:a.x+10,y:a.y});
  Object.assign(b,{x:a.x-8,y:a.y});
  const starting = world(1).wallet!(npc.id);
  game.act(a,{kind:'supply',place:'secretary',target:'queue'},world(1));
  const document = game.view(a,world(1)).inventory[0];
  talk.act(a,{kind:'talk',target:npc.id},world(2));
  expect(talk.act(a,{kind:'sign',target:npc.id,item:document.id,amount:2},world(3))).toBe('Assinatura obtida.');
  expect(document.document?.signatures.map(signer=>signer.id)).toEqual([npc.id]);
  expect(talk.act(a,{kind:'sign',target:npc.id,item:document.id,amount:2},world(4))).toBe('A proposta de assinatura mudou.');
  expect(members.intention(npc.id,0)).toBe('no');
  expect(talk.act(a,{kind:'vote',target:npc.id,round:0,project:0,vote:'yes',amount:3},world(5))).toBe('Voto comprometido.');
  talk.act(b,{kind:'talk',target:npc.id},world(6));
  expect(talk.act(b,{kind:'vote',target:npc.id,round:0,project:0,vote:'no',amount:2},world(7))).toContain('recusada');
  expect(talk.act(b,{kind:'vote',target:npc.id,round:0,project:0,vote:'no',amount:4},world(8))).toBe('Voto comprometido.');
  expect(world(9).wallet!(npc.id)).toBe(starting+9);
  expect(world(9).wallet!(a.id)).toBe(3);
  expect(world(9).wallet!(b.id)).toBe(4);

  Object.assign(a,{x:631,y:197,direction:1});
  Object.assign(npc,{x:643,y:197});
  Object.assign(b,{x:636,y:208});
  Object.assign(a,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  game.act(a,{kind:'talk',target:'vendor'},world(10));
  game.act(a,{kind:'dialogue-choice',target:'products',token:game.view(a,world(10)).dialogue?.token},world(10));
  game.act(a,{kind:'shop-buy',target:'baton',token:game.view(a,world(10)).dialogue?.token},world(10));
  Object.assign(a,{x:631,y:197});
  const baton = game.view(a,world(10)).inventory.find(item=>item.kind==='baton')!;
  game.act(a,{kind:'equip',item:baton.id},world(10));
  const walletBeforeRobbery = world(11).wallet!(a.id);
  Object.assign(b,{x:630,y:215});
  for (let now=100;now<=5300;now+=1300) {
    game.act(a,{kind:'attack'},world(now));
    game.tick(world(now+140),true);
  }
  expect(npc.knockedOut).toBe(true);
  Object.assign(b,{x:634,y:196});
  for (const player of [a,b]) talk.act(player,{kind:'rob',target:npc.id},world(5500));
  talk.tick(world(5500+npcRules.robberyMs),true);
  expect(world(11).wallet!(npc.id)).toBe(0);
  expect(world(11).wallet!(a.id)).toBe(walletBeforeRobbery);
  const cash = game.view(a,world(11)).inventory.find(item=>item.kind==='briefcase')!;
  expect(cash.cash).toBe(starting+9);
  expect(game.view(b,world(11)).inventory).toEqual([]);
  const home = privateOffices[0];
  Object.assign(a,home.safe);
  game.act(a,{kind:'office-cash',place:home.id,item:cash.id},world(9_000));
  game.tick(world(9_000+officeRules.cashMs),true);
  expect(world(10_000).wallet!(a.id)).toBeGreaterThanOrEqual(starting+9+walletBeforeRobbery);

  npc.knockedOut = undefined;
  expect(members.intention(npc.id,0)).toBe('no');
  match.advance(NEGOTIATION_MS);
  match.recordNpcVote(npc.id,members.intention(npc.id,0)!);
  match.vote(a.id,'yes',NEGOTIATION_MS+1);
  match.vote(b.id,'no',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(match.view(a.id,[a.id,b.id],0).outcome).toMatchObject({yes:1,no:2,passed:false});
  match.advance(ELECTION_RULES.interval);
  expect(world(ELECTION_RULES.interval).wallet!(npc.id)).toBe(ELECTION_RULES.salary);
});

test('NPC routes stay on valid floor and stop for a negotiation',()=>{
  const {members,npcs:[npc]} = fixture();
  const start = {x:npc.x,y:npc.y};
  members.tick(0,.05,new Set([npc.id]),true);
  expect(npc).toMatchObject({...start,moving:false});
  const random = Math.random;
  Math.random = ()=>.99;
  try {
    for (let tick=0;tick<220;tick++) {
      members.tick(tick*50,.05,new Set(),true);
      expect(canStand(npc.x,npc.y)).toBe(true);
    }
  } finally { Math.random = random; }
  expect(npc).toMatchObject({x:140,y:146,moving:false});
});

test('an NPC stops walking on the first tick after it reaches its destination',()=>{
  const members = new Parliamentarians();
  members.reset(1,0);
  const [npc] = members.players;
  Object.assign(npc,{x:136,y:146});
  const random = Math.random;
  Math.random = ()=>.99;
  try {
    const paused = new Set<string>();
    members.tick(0,.1,paused,true);
    expect(npc).toMatchObject({x:140,y:146,moving:true});
    members.tick(100,.1,paused,true);
    expect(npc).toMatchObject({x:140,y:146,moving:false});
    members.tick(npcRules.pauseMs-1,.1,paused,true);
    expect(npc).toMatchObject({x:140,y:146,moving:false});
  } finally { Math.random = random; }
});

test('NPC preferences are tied to projects and paid promises stay on the negotiated bill',()=>{
  const {members,npcs:[npc]} = fixture();
  expect(members.intention(npc.id,0,0)).toBe('yes');
  expect(members.intention(npc.id,1,0)).toBe('yes');
  expect(members.intention(npc.id,0,1)).toBe('no');
  members.commit(npc.id,0,'yes',3,1);
  expect(members.minimum(npc.id,0,'no',1)).toBe(4);
  expect(members.minimum(npc.id,0,'no',0)).toBe(2);
  expect(members.intention(npc.id,1,1)).toBe('no');
  const {humans:[buyer],talk,match,world} = fixture();
  const target = world(1).players.find(player=>player.npc)!;
  Object.assign(buyer,{x:target.x+8,y:target.y});
  talk.act(buyer,{kind:'talk',target:target.id},world(1));
  expect(talk.view(buyer,world(1))?.projectIndex).toBe(0);
  world(2).publish({type:'filed',actor:buyer.id,project:1,at:2,position:buyer,witnesses:[]});
  expect(match.projectIndex).toBe(1);
  expect(talk.view(buyer,world(3))?.projectIndex).toBe(1);
  const balance = world(3).wallet!(buyer.id);
  talk.act(buyer,{kind:'vote',target:target.id,round:0,project:0,vote:'no',amount:2},world(3));
  expect(world(3).wallet!(buyer.id)).toBe(balance);

});
