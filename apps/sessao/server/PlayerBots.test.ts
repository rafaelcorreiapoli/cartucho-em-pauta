import {expect,test,spyOn} from 'bun:test';
import {terminals,type GameplayEvent} from '../src/gameplay';
import {privateOffices} from '../src/private-offices';
import {characterStats} from '../src/character-stats';
import {ELECTION_RULES} from '../src/elections';
import {characterVisible,inPlenary,PLENARY_SEATS,roomAt,type Player} from '../src/map';
import {STEP_MS,type ControlState} from '../src/movement';
import {BALLOT_MS,MIN_PLAYERS,projectRules,stations} from '../src/plenary';
import {Gameplay} from './Gameplay';
import {PlayerBots} from './PlayerBots';
import {PlenaryMatch} from './PlenaryMatch';
import {publishProjectFiling} from './project-test-fixture';
import {StationCooldowns} from './StationCooldowns';

const host:Player = {id:'host',nick:'Bot 1',character:0,x:140,y:146,direction:0,moving:false};

function gameWithBots(random:()=>number,featuresEnabled=true,projectVotingEnabled=featuresEnabled) {
  const human = {...host};
  const controls = new Map<string,ControlState>([[human.id,{player:human,route:[],ack:0}]]);
  const bots = new PlayerBots();
  bots.addTo(controls,0,random);
  const players = [...controls.values()].map(state=>state.player);
  const cooldowns = new StationCooldowns();
  const match = new PlenaryMatch(MIN_PLAYERS,cooldowns);
  const gameplay = new Gameplay(cooldowns,()=>match.powerOut);
  expect(match.start(human.id,players,0,random,1,false,featuresEnabled,projectVotingEnabled,featuresEnabled,featuresEnabled,featuresEnabled,featuresEnabled,featuresEnabled)).toBe(true);
  Object.assign(gameplay,{phoneGamesEnabled:featuresEnabled,projectVotingEnabled,
    photosEnabled:featuresEnabled,surveillanceEnabled:featuresEnabled,decorationsEnabled:featuresEnabled,portraitsAndVipEnabled:featuresEnabled});
  gameplay.reset(0,random,players,random);
  for (const player of players) Object.assign(player,gameplay.officeSpawn(player.id));
  const ids = [...controls.keys()];
  const view = (id:string,now:number)=>match.view(id,ids,now);
  let now = 0;
  let previousPhase = match.phase;
  const events:GameplayEvent[] = [];
  const worldAt = (at:number) => {
    const world = match.gameplayWorld(players,at,()=>false);
    return {...world,vision:(id:string)=>gameplay.vision(id,at),present:()=>true,
      publish:(event:GameplayEvent)=>{
        if (world.publish(event)) events.push(event);
      }};
  };
  return {human,controls,bots,players,match,view,gameplay,worldAt,events,
    advance(until:number) {
      for (;now<=until && match.running;now+=STEP_MS) {
        if (match.ballotCountdown(match.gameTime(now))===undefined) {
          for (const state of controls.values()) if (state.player.bot) bots.move(state,gameplay.phoneActivity(state.player.id));
        }
        match.advance(now);
        if (match.phase!==previousPhase) {
          previousPhase = match.phase;
          [...controls.values()].forEach((control,index)=>{
            control.route = [];
            control.plenary = match.phase==='ballot';
            if (control.plenary) Object.assign(control.player,PLENARY_SEATS[index]);
          });
        }
        const world = worldAt(match.gameTime(now));
        gameplay.tick(world,match.phase==='negotiation');
        bots.tick(match,gameplay,world,(state,peer)=>
          (!state.plenary || inPlenary(peer)) &&
          (state.plenary && !match.powerOut || characterVisible(state.player,peer,world.vision(state.player.id))),now);
        match.advancePower(world.now,id=>controls.get(id)?.player);
      }
    },
  };
}

test('five identifiable bots fill the solo roster, share role assignment and are removed for the rematch',()=>{
  const {bots,controls,players,view,human} = gameWithBots(()=>0.4);
  const roles = players.map(player=>view(player.id,0).role);
  expect(players.filter(player=>player.bot)).toHaveLength(5);
  expect(new Set(players.map(player=>player.nick)).size).toBe(6);
  expect(roles.filter(role=>role==='Infiltrado')).toHaveLength(1);
  expect(view(human.id,0).role).toBe('Parlamentar');
  expect(view(players[2].id,0).role).toBe('Infiltrado');
  expect(view(human.id,0).electorate).toBe(6);
  bots.clear(controls);
  expect([...controls.keys()]).toEqual([human.id]);
});

test('a solo infiltrator can leave filing, signatures, and legislative voting to the bots',()=>{
  const {advance,bots,human,match,view} = gameWithBots(()=>0);
  expect(view(human.id,0).role).toBe('Infiltrado');
  advance(29_000);
  expect(match.projectIndex).toBeUndefined();
  const afterFiling = 75_000;
  advance(afterFiling);
  expect(view(human.id,afterFiling).proposer).toMatch(/^Bot /);
  expect(match.projectIndex).toBeDefined();
  const duringBallot = afterFiling+view(human.id,afterFiling).remaining*1000+22_000;
  advance(duringBallot);
  expect(view(human.id,duringBallot).phase).toBe('ballot');
  expect(view(human.id,duringBallot).voted).toBe(5);
  expect(bots.messages).toHaveLength(5);
  advance(duringBallot+BALLOT_MS);
  expect(view(human.id,duringBallot+BALLOT_MS).outcomes).toHaveLength(1);
  expect(bots.messages).toHaveLength(0);
  const afterProtocolReopens = duringBallot+BALLOT_MS+projectRules.cooldownMs+60_000;
  advance(afterProtocolReopens);
  expect(view(human.id,afterProtocolReopens).protocolCooldown).toBeUndefined();
  expect(match.projectIndex).toBeUndefined();
  advance(ELECTION_RULES.matchDuration);
  expect(match.phase).toBe('finished');
  expect(view(human.id,ELECTION_RULES.matchDuration).winner).toBeDefined();
});

test('an infiltrator bot attempts a cut and two separate bots repair the panels',()=>{
  const {advance,match,human,view} = gameWithBots(()=>0.4);
  let cut = false;
  let repaired = false;
  for (let now=0;now<110_000 && !repaired;now+=500) {
    advance(now);
    const outage = !!view(human.id,now).outage;
    if (cut && !outage) repaired = true;
    if (outage) cut = true;
  }
  expect(match.phase).toBe('negotiation');
  expect(cut).toBe(true);
  expect(repaired).toBe(true);
});

test('a bot hides an expensive project’s cost and another bot audits and corrects it',()=>{
  const {advance,match,human,players,view} = gameWithBots(()=>0.4);
  Reflect.set(match,'budget',8);
  publishProjectFiling(match,human);
  const infiltrator = players[2];
  let fraudulent = false;
  let corrected = false;
  for (let now=0;now<105_000 && !corrected;now+=500) {
    advance(now);
    const publicView = view(human.id,now);
    const privateView = view(infiltrator.id,now);
    if (publicView.yes.budget>privateView.yes.budget) fraudulent = true;
    if (fraudulent && publicView.reportedFraud) corrected = true;
  }
  expect(fraudulent).toBe(true);
  expect(corrected).toBe(true);
  advance(projectRules.debateMs+27_000);
  expect(view(human.id,projectRules.debateMs+27_000).voted).toBe(5);
});

test('an affordable evidence offer can change a bot vote on a close project',()=>{
  const {advance,bots,human,match,players,view} = gameWithBots(()=>0.4);
  Object.assign(human,stations.cabinet);
  match.politics(human,{kind:'grant',area:'health',amount:2,diversion:50},players,0);
  const proof = view(human.id,0).politics!.evidence.find(entry=>entry.kind==='diversion')!;
  publishProjectFiling(match,human,6);
  Reflect.get(match,'proposal').voteAt = 0;
  advance(19_000);
  const buyer = players.find(player=>player.bot && view(player.id,19_000).vote==='yes')!;
  expect(buyer).toBeDefined();
  const wallet = view(buyer.id,19_000).politics!.wallet;
  Object.assign(human,{x:buyer.x,y:buyer.y});
  match.politics(human,{kind:'share',to:buyer.id,evidence:proof.id,price:1},players,19_000);
  advance(22_000);
  expect(view(buyer.id,22_000)).toMatchObject({vote:'no',politics:{wallet:wallet-1}});
  expect(bots.messages.find(message=>message.name===buyer.nick)?.text).toMatch(/Mudei meu voto.*comprova um desvio/);
});

test('bots complete private agenda tasks and spread out around the map',()=>{
  const {advance,human,players,view} = gameWithBots(()=>0);
  const bots = players.filter(player=>player!==human);
  let mostRoomsOccupied = 0;
  for (let now=60_000;now<=95_000;now+=1_000) {
    advance(now);
    mostRoomsOccupied = Math.max(mostRoomsOccupied,new Set(bots.map(bot=>roomAt(bot))).size);
  }
  expect(bots.some(bot=>view(bot.id,95_000).politics?.missions.completed.some(mission=>mission.kind==='pizza'))).toBe(true);
  expect(mostRoomsOccupied).toBeGreaterThanOrEqual(3);
});

test('bots walk below their character’s normal speed and stay still during phone activity',()=>{
  const {bots,controls,players} = gameWithBots(()=>0);
  const player = players[1];
  const state = controls.get(player.id)!;
  Object.assign(player,{x:140,y:146});
  state.route = [{x:160,y:146}];
  bots.move(state,undefined);
  const distance = player.x-140;
  expect(distance).toBeGreaterThan(0);
  expect(distance).toBeLessThan(characterStats[player.character].speed*STEP_MS/1000);
  const position = {x:player.x,y:player.y};
  for (const activity of ['call','open','game'] as const) {
    state.route = [{x:160,y:146}];
    bots.move(state,activity);
    expect(player).toMatchObject({...position,moving:false});
    expect(state.route).toEqual([]);
  }
  state.route = [{x:160,y:146}];
  bots.move(state,undefined);
  expect(player.x).toBeGreaterThan(position.x);
});

test.each([{roll:0,expected:'money-pocketed'}, {roll:.9,expected:'delivered'}])(
  'a bot collects a visible briefcase and completes its $expected plan',
  ({roll,expected})=>{
    const {advance,events,gameplay,human,players,worldAt} = gameWithBots(()=>roll);
    const bot = players[3];
    const office = privateOffices.find(office=>office.id===gameplay.view(bot,worldAt(0)).ownOffice)!;
    const point = expected==='money-pocketed' ? office.safe : terminals.treasury.point;
    Object.assign(human,point);
    Object.assign(bot,point);
    const world = {...worldAt(0),takeWallet:()=>3};
    gameplay.robNpc(human,{...human,id:'cash-source',npc:true},world);
    const item = gameplay.view(human,world).inventory.find(item=>item.kind==='briefcase')!;
    gameplay.act(human,{kind:'drop',item:item.id},world);
    advance(3_000);
    expect(gameplay.hasVisibleCash(bot.id,3_000,human.id)).toBe(true);
    advance(32_000);
    expect(events).toContainEqual(expect.objectContaining({actor:bot.id,item:item.id,type:expected}));
    expect(gameplay.hasVisibleCash(bot.id,32_000,human.id)).toBe(false);
  });

for (const training of [false,true]) test(`bots accept offers and sign documents (training=${training})`,()=>{
  const {match,gameplay,human,players,bots,controls,worldAt,events,advance} = gameWithBots(()=>.4);
  match.training = training;
  const guide = players.find(person=>person.bot)!;
  const world = (now:number)=>({...worldAt(now),training,voice:()=>true});
  Object.assign(human,stations.coffee);
  Object.assign(guide,{x:human.x+40,y:human.y});
  gameplay.giveTrainingItem(human.id,'coffee');
  const coffee = gameplay.view(human,world(1)).inventory.find(item=>item.kind==='coffee')!;
  expect(gameplay.act(human,{kind:'offer',item:coffee.id,target:guide.id},world(1))).toBe('Pedido enviado.');
  bots.tick(match,gameplay,world(1000),()=>true);
  expect(gameplay.view(guide,world(1000)).inventory.some(item=>item.kind==='coffee')).toBe(true);
  expect(events.some(event=>event.type==='transferred' && event.actor===human.id)).toBe(true);
  if (training) {
    expect(gameplay.act(human,{kind:'call',target:guide.id},world(1001))).toBeDefined();
    bots.tick(match,gameplay,world(2000),()=>true);
    expect(gameplay.phoneActivity(human.id)).toBe('call');
    gameplay.act(human,{kind:'hangup'},world(2001));
  }
  Object.assign(human,stations.secretary);
  Object.assign(guide,{x:human.x+40,y:human.y});
  gameplay.act(human,{kind:'supply',place:'secretary'},world(2002));
  const document = gameplay.view(human,world(2002)).inventory.find(item=>item.kind==='document')!;
  gameplay.act(human,{kind:'sign-request',item:document.id,target:guide.id},world(2003));
  bots.tick(match,gameplay,world(3000),()=>true);
  expect(document.document?.signatures.some(person=>person.id===guide.id)).toBe(true);
  if (training) {
    advance(180_000);
    expect(match.projectIndex).toBeUndefined();
  }
});

test('training guide approaches only for interactions and keeps space around the learner',()=>{
  const {match,gameplay,human,players,bots,controls,worldAt} = gameWithBots(()=>.4);
  match.training = true;
  const guide = players.find(person=>person.bot)!;
  Object.assign(human,stations.coffee);
  Object.assign(guide,{x:human.x+80,y:human.y});
  bots.tick(match,gameplay,worldAt(1000),()=>true);
  bots.move(controls.get(guide.id)!,undefined);
  expect(controls.get(guide.id)!.route).toEqual([]);
  bots.tick(match,gameplay,worldAt(2000),()=>true,2000,true);
  bots.move(controls.get(guide.id)!,undefined);
  const destination = controls.get(guide.id)!.route.at(-1)!;
  expect(destination).toBeDefined();
  expect(Math.hypot(destination.x-human.x,destination.y-human.y)).toBeGreaterThanOrEqual(18);
  expect(Math.hypot(destination.x-human.x,destination.y-human.y)).toBeLessThanOrEqual(24);
});

test.each([true,false])('bots skip document filing when projects are disabled (other features=%s)',featuresEnabled=>{
  const {advance,gameplay,worldAt,players,human,view,events} = gameWithBots(()=>0,featuresEnabled,false);
  const bots = players.filter(player=>player.bot);
  const actions = spyOn(gameplay,'act');
  for (let now=35_000;now<=150_000;now+=5_000) {
    advance(now);
    for (const bot of bots) {
      expect(gameplay.view(bot,worldAt(now)).inventory.some(item=>item.document)).toBe(false);
      if (!featuresEnabled) expect(gameplay.phoneActivity(bot.id)).not.toBe('game');
    }
  }
  expect(view(human.id,150_000).projectVotingEnabled).toBe(false);
  expect(view(human.id,150_000).project).toBeUndefined();
  expect(events.some(event=>event.type==='signed')).toBe(false);
  expect(actions.mock.calls.some(([,action])=>action.kind==='supply' && action.place==='secretary' ||
    action.kind==='sign-request' || action.kind==='talk' && action.target==='protocol')).toBe(false);
  actions.mockRestore();
});
