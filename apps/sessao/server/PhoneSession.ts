import {MINIGAME_FRUIT_XP} from '../src/progression';
import { CANDY_BURST_MS, newCandyBoard, swapCandy, type CandyRound } from '../src/candy';
import { BET_PAYOUT, BET_SPIN_MS, BET_STAKES, BET_SYMBOLS, winningReels, type BetsRound } from '../src/bets';
import { randomInt } from 'node:crypto';
import type { GameplayView, PhoneAction, PhoneActivity } from '../src/gameplay';
import { worldVisible, type Player } from '../src/map';
import { SNAKE_ROUND_MS, createSnake, stepSnake, turnSnake, type SnakeRound } from '../src/snake';
import { gameplayWitnesses, publishGameplay, type GameplayWorld } from './gameplay-world';

type Call = {id:number; from:string; to:string; connected:boolean; expires:number; sampledAt?:number};
type PhoneRound = {id:number;snake:SnakeRound; startedAt?:number; sampledAt:number; witnesses:Set<string>};
type PhoneWorld = Pick<GameplayWorld,'players'|'now'|'voice'|'publish'|'present'|'vision'|'hasMission'|'wallet'|'settleBet'|'earnXp'>;

export class PhoneSession {
  private nextCallId = 0;
  private calls = new Map<string,Call>();
  private games = new Map<string,PhoneRound>();
  private nextGameId = 0;
  private miniGames = new Map<string,number>();
  private nextCandyId = 0;
  private candy = new Map<string,{round:CandyRound;readyAt:number}>();
  private bets = new Map<string,{round:BetsRound;readyAt:number}>();
  private openScreens = new Set<string>();

  reset() {
    this.calls.clear();
    this.games.clear();
    this.miniGames.clear();
    this.bets.clear();
    this.candy.clear();
    this.openScreens.clear();
  }

  tick(world:PhoneWorld, exploring:boolean, inOwnOffice?:(player:Player)=>boolean) {
    if (!exploring) {
      this.openScreens.clear();
      this.miniGames.clear();
      this.candy.clear();
    }
    for (const call of new Set(this.calls.values())) {
      if (!exploring || !world.voice(call.from) || !world.voice(call.to) || (!call.connected && call.expires<=world.now)) {
        this.endCall(call,world);
      } else if (call.connected) {
        this.sampleCall(call,world);
      }
    }
    for (const [id,game] of this.games) {
      const player = world.players.find(person => person.id===id);
      if (!exploring || !player || world.present?.(id)===false || player.knockedOut || player.carrying) {
        if (player) this.stopPhoneGame(player,world);
        else this.games.delete(id);
        continue;
      }
      if (!this.playingPhoneGame(game)) continue;
      const witnesses = world.players.filter(other=>other.id!==id && world.present?.(other.id)!==false &&
        worldVisible(other,player,world.vision?.(other.id))).map(other=>other.id);
      for (const witness of witnesses) game.witnesses.add(witness);
      if (game.snake.status!=='playing' || game.startedAt===undefined) continue;
      const deadline = game.startedAt+SNAKE_ROUND_MS;
      const duration = Math.min(100,Math.min(world.now,deadline)-game.sampledAt);
      game.sampledAt = world.now;
      if (duration>0 &&
          (world.hasMission?.(id,'jogar') || world.hasMission?.(id,'jogarOculto') || world.hasMission?.(id,'produtividade'))) {
        publishGameplay(world,player,'game-played',{duration,witnesses,place:inOwnOffice?.(player) ? 'own-office' : undefined});
      }
      if (world.now>=deadline) game.snake.status = 'lost';
      else {
        const score = game.snake.score;
        stepSnake(game.snake,world.now);
        const collected = game.snake.score-score;
        if (collected>0) world.earnXp?.(id,collected*MINIGAME_FRUIT_XP);
      }
      if (!this.playingPhoneGame(game)) {
        publishGameplay(world,player,game.snake.status==='won' ? 'game-won' : 'game-stopped',
          {duration:Math.min(world.now,deadline)-game.startedAt,witnesses:game.witnesses});
      }
    }
  }

  private sampleCall(call:Call,world:PhoneWorld) {
    const caller = world.players.find(({id})=>id===call.from);
    const receiver = world.players.find(({id})=>id===call.to);
    if (!caller || !receiver || caller.knockedOut || receiver.knockedOut ||
        world.present?.(caller.id)===false || world.present?.(receiver.id)===false) {
      call.sampledAt = undefined;
      return;
    }
    const duration = Math.min(100,world.now-(call.sampledAt ?? world.now));
    call.sampledAt = world.now;
    if (duration<=0) return;
    for (const [player,target] of [[caller,receiver],[receiver,caller]]) {
      if (world.hasMission?.(player.id,'debateTelefonico') || world.hasMission?.(player.id,'chamadasUrgentes')) {
        publishGameplay(world,player,'call-time',{target:target.id,duration,item:call.id,witnesses:[]});
      }
    }
  }

  private playingPhoneGame(game:PhoneRound | undefined) {
    return game?.snake.status==='ready' || game?.snake.status==='playing';
  }

  private stopPhoneGame(player:Player, world:PhoneWorld) {
    const game = this.games.get(player.id);
    if (game && this.playingPhoneGame(game)) {
      publishGameplay(world,player,'game-stopped',{duration:game.startedAt===undefined ? 0 : Math.min(SNAKE_ROUND_MS,world.now-game.startedAt),witnesses:game.witnesses});
    }
    this.games.delete(player.id);
  }

  disconnectCall(id:string, world:PhoneWorld) {
    const call = this.calls.get(id);
    if (call) this.endCall(call,world);
  }

  leave(player:Player, world:PhoneWorld) {
    this.openScreens.delete(player.id);
    this.miniGames.delete(player.id);
    this.candy.delete(player.id);
    this.disconnectCall(player.id,world);
    this.stopPhoneGame(player,world);
  }

  gameSession(id:string) {
    const snake = this.games.get(id);
    if (snake && this.playingPhoneGame(snake)) return snake.id;
    return this.miniGames.get(id);
  }

  activity(id:string):PhoneActivity|undefined {
    if (this.gameSession(id)!==undefined) return 'game';
    if (this.calls.get(id)?.connected) return 'call';
    if (this.openScreens.has(id)) return 'open';
  }

  callPeer(id:string) {
    const call = this.calls.get(id);
    if (call?.connected) return call.from===id ? call.to : call.from;
  }

  view(id:string, players:Player[]):Pick<GameplayView,'call'|'game'|'bets'|'candy'> {
    const call = this.calls.get(id);
    const peer = call && players.find(other => other.id===(call.from===id ? call.to : call.from));
    const game = this.games.get(id)?.snake;
    return {
      call:call && peer ? {peer:{id:peer.id,name:peer.nick},state:call.connected ? 'connected' : call.from===id ? 'outgoing' : 'incoming'} : undefined,
      candy:this.candy.get(id)?.round,
      bets:this.bets.get(id)?.round,
      game:game && {body:game.body,food:game.food,score:game.score,status:game.status},
    };
  }

  private endCall(call:Call, world:PhoneWorld, actor?:Player) {
    this.calls.delete(call.from);
    this.calls.delete(call.to);
    const player = actor ?? world.players.find(person => person.id===call.from);
    if (player && call.connected) publishGameplay(world,player,'hung-up',{target:player.id===call.from ? call.to : call.from});
  }

  private canPlayMiniGame(player:Player,world:PhoneWorld) {
    return this.openScreens.has(player.id) && world.present?.(player.id)!==false && !player.knockedOut &&
      !player.carried && !player.carrying && !this.playingPhoneGame(this.games.get(player.id));
  }

  act(player:Player, action:PhoneAction, world:PhoneWorld) {
    const id = player.id;
    const call = this.calls.get(id);
    switch (action.kind) {
      case 'phone-open':
        if (!player.carried) this.openScreens.add(id);
        return;
      case 'phone-close':
        this.openScreens.delete(id);
        this.miniGames.delete(id);
        this.candy.delete(id);
        this.stopPhoneGame(player,world);
        return;
      case 'call': {
        const target = world.players.find(person => !person.npc && person.id===action.target && person.id!==id);
        if (!target || !world.voice(id) || !world.voice(target.id)) return 'Os dois jogadores precisam ativar a voz.';
        if (call || this.calls.has(target.id)) return 'Linha ocupada.';
        const next = {id:++this.nextCallId,from:id,to:target.id,connected:false,expires:world.now+20_000};
        this.calls.set(id,next);
        this.calls.set(target.id,next);
        return 'Chamando…';
      }
      case 'answer':
        if (!call || call.to!==id || call.connected || call.expires<=world.now ||
          !world.voice(id) || !world.voice(call.from)) return 'Chamada indisponível.';
        call.connected = true;
        call.sampledAt = world.now;
        publishGameplay(world,player,'called',{target:call.from});
        return 'Ligação atendida.';
      case 'hangup':
        if (call) this.endCall(call,world,player);
        return 'Ligação encerrada.';
      case 'candy-start':
      case 'candy-swap': {
        if (!this.canPlayMiniGame(player,world)) return;
        const previous = this.candy.get(id);
        if (previous && previous.readyAt>world.now) return;
        if (action.kind==='candy-start') {
          this.miniGames.set(id,++this.nextGameId);
          this.candy.set(id,{round:{id:++this.nextCandyId,board:newCandyBoard(),score:0},readyAt:world.now});
          return;
        }
        if (!previous || action.token!==previous.round.id || !action.cells) return;
        const move = swapCandy(previous.round.board,...action.cells);
        if (!move?.matches.size) return;
        const count = move.matches.size;
        this.candy.set(id,{round:{id:++this.nextCandyId,board:newCandyBoard(move.board,move.matches),
          score:previous.round.score+count},readyAt:world.now+CANDY_BURST_MS});
        world.earnXp?.(id,count*MINIGAME_FRUIT_XP);
        return;
      }
      case 'bets-spin': {
        if (!this.canPlayMiniGame(player,world)) return 'Abra o Bets no celular para apostar.';
        const previous = this.bets.get(id);
        if (action.token!==(previous?.round.id ?? 0) || (previous?.readyAt ?? 0)>world.now) return;
        const amount = BET_STAKES.find(stake=>stake===action.quantity);
        if (!amount) return 'Valor de aposta inválido.';
        const stake = amount/10;
        if (Math.round((world.wallet?.(id) ?? 0)*10)<amount) return 'Saldo insuficiente para apostar.';
        const reels = Array.from({length:3},()=>randomInt(BET_SYMBOLS.length));
        const maxPayout = amount*BET_PAYOUT/10;
        const payout = winningReels(reels) ? maxPayout : 0;
        if (!world.settleBet?.(id,stake,payout,maxPayout)) return 'O Bets está sem reserva para pagar o prêmio desta aposta.';
        if (!this.miniGames.has(id)) this.miniGames.set(id,++this.nextGameId);
        this.bets.set(id,{round:{id:(previous?.round.id ?? 0)+1,reels,stake,payout},readyAt:world.now+BET_SPIN_MS});
        return;
      }
      case 'game-start':
        if (!this.canPlayMiniGame(player,world)) return;
        this.games.set(id,{id:++this.nextGameId,snake:createSnake(world.now),sampledAt:world.now,witnesses:new Set(gameplayWitnesses(world.players,player))});
        publishGameplay(world,player,'game-started');
        return;
      case 'game-stop':
        this.miniGames.delete(id);
        this.candy.delete(id);
        this.stopPhoneGame(player,world);
        return;
      case 'game-turn': {
        const game = this.games.get(id);
        if (game && action.direction) {
          turnSnake(game.snake,action.direction,world.now);
          if (game.startedAt===undefined && game.snake.status==='playing') {
            game.startedAt = world.now;
            game.sampledAt = world.now;
          }
        }
        return;
      }
    }
  }
}
