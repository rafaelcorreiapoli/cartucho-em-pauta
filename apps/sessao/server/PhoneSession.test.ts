import {MINIGAME_FRUIT_XP} from '../src/progression';
import {expect,test} from 'bun:test';
import {BET_PAYOUT,BET_SPIN_MS,winningReels} from '../src/bets';
import {CANDY_BURST_MS} from '../src/candy';
import {SNAKE_ROUND_MS,SNAKE_STEP_MS} from '../src/snake';
import {PoliticalEconomy} from './PoliticalEconomy';
import {PhoneSession} from './PhoneSession';
import type {GameplayAction,GameplayEvent} from '../src/gameplay';
import type {Player} from '../src/map';

test('phone invitations expire and release both lines without connecting',()=>{
  const phone = new PhoneSession();
  const caller:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const receiver:Player = {...caller,id:'b',nick:'Bia'};
  const events:GameplayEvent[] = [];
  const world = {players:[caller,receiver],now:10,voice:()=>true,publish:(event:GameplayEvent)=>events.push(event)};
  expect(phone.act(caller,{kind:'call',target:receiver.id},world)).toBe('Chamando…');
  expect(phone.callPeer(caller.id)).toBeUndefined();
  world.now += 20_000;
  expect(phone.act(receiver,{kind:'answer'},world)).toBe('Chamada indisponível.');
  phone.tick(world,true);
  expect(phone.view(caller.id,world.players).call).toBeUndefined();
  expect(phone.view(receiver.id,world.players).call).toBeUndefined();
  expect(events).toEqual([]);
  expect(phone.act(receiver,{kind:'call',target:caller.id},world)).toBe('Chamando…');
});

test('only connected, present players in articulation receive bounded mission time',()=>{
  const phone = new PhoneSession();
  const caller:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const receiver:Player = {...caller,id:'b',nick:'Bia'};
  const events:GameplayEvent[] = [];
  let connected = true;
  const world = {players:[caller,receiver],now:10,voice:()=>true,present:()=>connected,
    hasMission:()=>true,publish:(event:GameplayEvent)=>events.push(event)};
  phone.act(caller,{kind:'call',target:receiver.id},world);
  world.now = 1000;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toEqual([]);
  expect(phone.act(receiver,{kind:'answer'},world)).toBe('Ligação atendida.');
  world.now += 4000;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time').map(event=>[event.actor,event.target,event.duration]))
    .toEqual([['a','b',100],['b','a',100]]);
  connected = false;
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toHaveLength(2);
  connected = true;
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toHaveLength(2);
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time').slice(2).map(event=>event.duration)).toEqual([50,50]);
  phone.tick(world,false);
  expect(phone.callPeer(caller.id)).toBeUndefined();
});

test('the open phone is visible until the screen closes, the player leaves or articulation ends',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const world = {players:[player],now:10,voice:()=>true,publish:()=>{}};
  phone.act(player,{kind:'phone-open'},world);
  expect(phone.activity(player.id)).toBe('open');
  phone.act(player,{kind:'game-start'},world);
  expect(phone.activity(player.id)).toBe('game');
  phone.act(player,{kind:'game-stop'},world);
  expect(phone.activity(player.id)).toBe('open');
  phone.act(player,{kind:'phone-close'},world);
  expect(phone.activity(player.id)).toBeUndefined();
  phone.act(player,{kind:'phone-open'},world);
  phone.tick(world,false);
  expect(phone.activity(player.id)).toBeUndefined();
  phone.act(player,{kind:'phone-open'},world);
  phone.leave(player,world);
  expect(phone.activity(player.id)).toBeUndefined();
});

test('Bets settles once against the wallet and preserves the result after closing the phone',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const economy = new PoliticalEconomy();
  economy.reset([{id:player.id,name:player.nick}],()=>0.5);
  const world = {players:[player],now:10,voice:()=>false,publish:()=>{},
    wallet:(id:string)=>economy.wallet(id),settleBet:economy.settleBet.bind(economy)};
  const spin = {kind:'bets-spin',quantity:2,token:0} as const;
  expect(phone.act(player,spin,world)).toBeDefined();
  expect(economy.wallet(player.id)).toBe(8);
  phone.act(player,{kind:'phone-open'},world);
  expect(phone.act(player,{...spin,quantity:3},world)).toBe('Valor de aposta inválido.');
  phone.act(player,spin,world);
  const round = phone.view(player.id,world.players).bets!;
  expect(round).toMatchObject({id:1,stake:0.2,payout:winningReels(round.reels) ? 0.2*BET_PAYOUT : 0});
  const balance = Math.round((8-round.stake+round.payout)*10)/10;
  expect(economy.wallet(player.id)).toBe(balance);
  phone.act(player,{...spin,token:round.id},world);
  world.now += BET_SPIN_MS;
  phone.act(player,spin,world);
  phone.act(player,{kind:'phone-close'},world);
  expect(economy.wallet(player.id)).toBe(balance);
  expect(phone.view(player.id,world.players).bets).toEqual(round);
  expect(phone.view('b',world.players).bets).toBeUndefined();
  expect(economy.spend(player.id,balance)).toBe(true);
  phone.act(player,{kind:'phone-open'},world);
  expect(phone.act(player,{...spin,token:round.id},world)).toBe('Saldo insuficiente para apostar.');
});

test('Bets credits active rounds, excludes idle gaps and stops when the phone closes',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const events:GameplayEvent[] = [];
  const world = {players:[player],now:0,voice:()=>false,publish:(event:GameplayEvent)=>events.push(event),
    wallet:()=>8,settleBet:()=>true,hasMission:()=>true};
  const spin = (token:number)=>phone.act(player,{kind:'bets-spin',quantity:2,token},world);
  const tick = (count:number)=>{
    for (let i=0;i<count;i++) {
      world.now += 100;
      phone.tick(world,true,()=>true);
    }
  };
  const played = ()=>events.filter(event=>event.type==='game-played').reduce((sum,event)=>sum+(event.duration ?? 0),0);
  phone.act(player,{kind:'phone-open'},world);
  tick(40);
  expect(played()).toBe(0);
  spin(0);
  tick(20);
  spin(0); // replay
  tick(20);
  expect(played()).toBe(3000);
  expect(events.every(event=>event.place==='own-office')).toBe(true);
  for (let token=1;token<=8;token++) {
    spin(token);
    tick(25);
  }
  expect(played()).toBe(23_000);
  phone.act(player,{kind:'phone-close'},world);
  tick(10);
  expect(played()).toBe(23_000);
});

test('Snake awards XP once when a fruit is collected',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const rewards:number[] = [];
  const world = {players:[player],now:0,voice:()=>false,publish:()=>{},earnXp:(_:string,xp:number)=>rewards.push(xp)};
  phone.act(player,{kind:'phone-open'},world);
  phone.act(player,{kind:'game-start'},world);
  phone.act(player,{kind:'game-turn',direction:'right'},world);
  for (let tick=1;tick<=3;tick++) {
    world.now = tick*SNAKE_STEP_MS;
    phone.tick(world,true);
  }
  phone.tick(world,true);
  expect(phone.view(player.id,world.players).game?.score).toBe(1);
  expect(rewards).toEqual([MINIGAME_FRUIT_XP]);
});

test('Combina Doces awards XP for each matched fruit and rejects replayed swaps',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const rewards:number[] = [];
  const samples:GameplayEvent[] = [];
  const world = {players:[player],now:0,voice:()=>false,publish:(event:GameplayEvent)=>samples.push(event),hasMission:()=>true,earnXp:(_:string,xp:number)=>rewards.push(xp)};
  phone.act(player,{kind:'phone-open'},world);
  phone.act(player,{kind:'candy-start'},world);
  const round = phone.view(player.id,world.players).candy!;
  round.board.splice(0,25,
    0,0,2,3,4,
    1,2,0,4,0,
    2,3,4,0,1,
    3,4,0,1,2,
    4,0,1,2,3);
  phone.act(player,{kind:'candy-swap',cells:[0,6],token:round.id},world);
  world.now = 100;
  phone.tick(world,true);
  expect(samples).toEqual([]);
  expect(rewards).toEqual([]);
  const swap = {kind:'candy-swap',cells:[2,7],token:round.id} satisfies GameplayAction;
  phone.act(player,swap,world);
  world.now += 100;
  phone.tick(world,true);
  expect(samples).toMatchObject([{type:'game-played',duration:100}]);
  world.now += CANDY_BURST_MS;
  phone.act(player,swap,world);
  expect(phone.view(player.id,world.players).candy?.score).toBe(3);
  expect(rewards).toEqual([3*MINIGAME_FRUIT_XP]);
  expect(phone.view('b',world.players).candy).toBeUndefined();
});

test('a winning bet credits only the profit and conserves the match reserve',()=>{
  const economy = new PoliticalEconomy();
  economy.reset([{id:'a',name:'Alice'}],()=>0.5);
  expect(economy.settleBet('a',0.5,4.5,4.5)).toBe(true);
  expect(economy.view('a',[],0,false,()=>true)).toMatchObject({wallet:12,walletIncome:4});
  expect(economy.settleBet('a',0.5,4.5,4.5)).toBe(true);
  expect(economy.wallet('a')).toBe(16);
  expect(economy.settleBet('a',0.5,0,4.5)).toBe(false);
  expect(economy.wallet('a')).toBe(16);
});

test('closing the phone ends Snake exactly once and blocks delayed play time and XP',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const events:GameplayEvent[] = [];
  const rewards:number[] = [];
  const world = {players:[player],now:0,voice:()=>false,publish:(event:GameplayEvent)=>events.push(event),
    hasMission:()=>true,earnXp:(_:string,xp:number)=>rewards.push(xp)};
  phone.act(player,{kind:'game-start'},world);
  expect(phone.view(player.id,world.players).game).toBeUndefined();
  phone.act(player,{kind:'phone-open'},world);
  phone.act(player,{kind:'game-start'},world);
  phone.act(player,{kind:'game-turn',direction:'right'},world);
  world.now = 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='game-played').map(event=>event.duration)).toEqual([50]);
  phone.act(player,{kind:'phone-close'},world);
  phone.act(player,{kind:'phone-close'},world);
  phone.act(player,{kind:'game-turn',direction:'right'},world);
  world.now = SNAKE_STEP_MS*3;
  phone.tick(world,true);
  expect(phone.view(player.id,world.players).game).toBeUndefined();
  expect(phone.activity(player.id)).toBeUndefined();
  expect(events.filter(event=>event.type==='game-stopped')).toHaveLength(1);
  expect(events.filter(event=>event.type==='game-played')).toHaveLength(1);
  expect(rewards).toEqual([]);
});

test('Snake starts its clock on valid input and credits only time before the deadline',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const events:GameplayEvent[] = [];
  const world = {players:[player],now:0,voice:()=>false,publish:(event:GameplayEvent)=>events.push(event),hasMission:()=>true};
  phone.act(player,{kind:'phone-open'},world);
  phone.act(player,{kind:'game-start'},world);
  world.now = SNAKE_ROUND_MS+100;
  phone.act(player,{kind:'game-turn',direction:'left'},world);
  phone.tick(world,true);
  expect(phone.view(player.id,world.players).game?.status).toBe('ready');
  expect(events.some(event=>event.type==='game-played')).toBe(false);

  phone.act(player,{kind:'game-turn',direction:'right'},world);
  const deadline = world.now+SNAKE_ROUND_MS;
  world.now = deadline-30;
  phone.tick(world,true);
  world.now = deadline+500;
  phone.tick(world,true);
  expect(phone.view(player.id,world.players).game?.status).toBe('lost');
  expect(events.filter(event=>event.type==='game-played').map(event=>event.duration)).toEqual([100,30]);
  expect(events.filter(event=>event.type==='game-stopped').map(event=>event.duration)).toEqual([SNAKE_ROUND_MS]);
});
