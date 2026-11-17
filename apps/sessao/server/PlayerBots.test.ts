import {expect,test} from 'bun:test';
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

function gameWithBots(random:()=>number) {
  const human = {...host};
  const controls = new Map<string,ControlState>([[human.id,{player:human,route:[],ack:0}]]);
  const bots = new PlayerBots();
  bots.addTo(controls,0,random);
  const players = [...controls.values()].map(state=>state.player);
  const cooldowns = new StationCooldowns();
  const match = new PlenaryMatch(MIN_PLAYERS,cooldowns);
  const gameplay = new Gameplay(cooldowns,()=>match.powerOut);
  expect(match.start(human.id,players,0,random)).toBe(true);
  gameplay.reset(0,random,players);
  for (const player of players) Object.assign(player,gameplay.officeSpawn(player.id));
  const ids = [...controls.keys()];
  const view = (id:string,now:number)=>match.view(id,ids,now);
  let now = 0;
  let previousPhase = match.phase;
  return {human,controls,bots,players,match,view,
    advance(until:number) {
      for (;now<=until && match.running;now+=STEP_MS) {
        if (match.ballotCountdown(now)===undefined) {
          for (const state of controls.values()) if (state.player.bot) bots.move(state);
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
        const world = {...match.gameplayWorld(players,now,()=>false),vision:(id:string)=>gameplay.vision(id,now),present:()=>true};
        gameplay.tick(world,match.phase==='negotiation',match.phase==='ballot');
        bots.tick(match,gameplay,world,(state,peer)=>
          (!state.plenary || inPlenary(peer)) &&
          (state.plenary && !match.powerOut || characterVisible(state.player,peer,world.vision(state.player.id))));
        match.advancePower(now,id=>controls.get(id)?.player);
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
  advance(45_000);
  expect(view(human.id,45_000).proposer).toMatch(/^Bot /);
  expect(match.projectIndex).toBeDefined();
  const duringBallot = 45_000+view(human.id,45_000).remaining*1000+22_000;
  advance(duringBallot);
  expect(view(human.id,duringBallot).phase).toBe('ballot');
  expect(view(human.id,duringBallot).voted).toBe(5);
  expect(bots.messages).toHaveLength(5);
  advance(duringBallot+BALLOT_MS);
  expect(view(human.id,duringBallot+BALLOT_MS).outcomes).toHaveLength(1);
  expect(bots.messages).toHaveLength(0);
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
  match.politics(human,{kind:'grant',diverted:1},players,0);
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
  advance(95_000);
  const bots = players.filter(player=>player!==human);
  expect(bots.some(bot=>view(bot.id,95_000).politics?.missions.completed.some(mission=>mission.kind==='pizza'))).toBe(true);
  expect(new Set(bots.map(bot=>roomAt(bot))).size).toBeGreaterThanOrEqual(3);
});
