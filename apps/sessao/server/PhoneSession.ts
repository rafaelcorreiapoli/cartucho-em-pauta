import type { GameplayView, PhoneAction } from '../src/gameplay';
import { worldVisible, type Player } from '../src/map';
import { createSnake, stepSnake, turnSnake, type SnakeRound } from '../src/snake';
import { gameplayWitnesses, publishGameplay, type GameplayWorld } from './gameplay-world';

type Call = {from:string; to:string; connected:boolean; expires:number; sampledAt?:number};
type PhoneRound = {snake:SnakeRound; start:number; sampledAt:number; witnesses:Set<string>};
type PhoneWorld = Pick<GameplayWorld,'players'|'now'|'voice'|'publish'|'present'|'vision'|'hasMission'>;

export class PhoneSession {
  private calls = new Map<string,Call>();
  private games = new Map<string,PhoneRound>();

  reset() {
    this.calls.clear();
    this.games.clear();
  }

  tick(world:PhoneWorld, exploring:boolean) {
    for (const call of new Set(this.calls.values())) {
      if (!exploring || !world.voice(call.from) || !world.voice(call.to) || (!call.connected && call.expires<=world.now)) {
        this.endCall(call,world);
      } else if (call.connected && call.sampledAt!==undefined) {
        const duration = Math.min(100,world.now-call.sampledAt);
        call.sampledAt = world.now;
        if (duration<=0) continue;
        for (const [id,target] of [[call.from,call.to],[call.to,call.from]]) {
          if (!world.hasMission?.(id,'debateTelefonico') && !world.hasMission?.(id,'chamadasUrgentes')) continue;
          const player = world.players.find(person=>person.id===id);
          if (player && !player.knockedOut && world.present?.(id)!==false && world.present?.(target)!==false) {
            publishGameplay(world,player,'call-time',{target,duration,item:call.expires,witnesses:[]});
          }
        }
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
      const duration = Math.min(100,world.now-game.sampledAt);
      game.sampledAt = world.now;
      const witnesses = world.players.filter(other=>other.id!==id && world.present?.(other.id)!==false &&
        worldVisible(other,player,world.vision?.(other.id))).map(other=>other.id);
      for (const witness of witnesses) game.witnesses.add(witness);
      if (game.snake.status==='playing' && duration>0 &&
          (world.hasMission?.(id,'jogar') || world.hasMission?.(id,'jogarOculto'))) {
        publishGameplay(world,player,'game-played',{duration,witnesses});
      }
      if (world.now-game.start>=60_000) game.snake.status = 'lost';
      else stepSnake(game.snake,world.now);
      if (!this.playingPhoneGame(game)) {
        publishGameplay(world,player,game.snake.status==='won' ? 'game-won' : 'game-stopped',
          {duration:world.now-game.start,witnesses:game.witnesses});
      }
    }
  }

  private playingPhoneGame(game:PhoneRound | undefined) {
    return game?.snake.status==='ready' || game?.snake.status==='playing';
  }

  private stopPhoneGame(player:Player, world:PhoneWorld) {
    const game = this.games.get(player.id);
    if (game && this.playingPhoneGame(game)) {
      publishGameplay(world,player,'game-stopped',{duration:world.now-game.start,witnesses:game.witnesses});
    }
    this.games.delete(player.id);
  }

  disconnectCall(id:string, world:PhoneWorld) {
    const call = this.calls.get(id);
    if (call) this.endCall(call,world);
  }

  leave(player:Player, world:PhoneWorld) {
    this.disconnectCall(player.id,world);
    this.stopPhoneGame(player,world);
  }

  activity(id:string) {
    if (this.playingPhoneGame(this.games.get(id))) return 'game';
    if (this.calls.get(id)?.connected) return 'call';
  }

  callPeer(id:string) {
    const call = this.calls.get(id);
    if (call?.connected) return call.from===id ? call.to : call.from;
  }

  view(id:string, players:Player[]):Pick<GameplayView,'call'|'game'> {
    const call = this.calls.get(id);
    const peer = call && players.find(other => other.id===(call.from===id ? call.to : call.from));
    const game = this.games.get(id)?.snake;
    return {
      call:call && peer ? {peer:{id:peer.id,name:peer.nick},state:call.connected ? 'connected' : call.from===id ? 'outgoing' : 'incoming'} : undefined,
      game:game && {body:game.body,food:game.food,score:game.score,status:game.status},
    };
  }

  private endCall(call:Call, world:PhoneWorld, actor?:Player) {
    this.calls.delete(call.from);
    this.calls.delete(call.to);
    const player = actor ?? world.players.find(person => person.id===call.from);
    if (player && call.connected) publishGameplay(world,player,'hung-up',{target:player.id===call.from ? call.to : call.from});
  }

  act(player:Player, action:PhoneAction, world:PhoneWorld) {
    const id = player.id;
    const call = this.calls.get(id);
    switch (action.kind) {
      case 'call': {
        const target = world.players.find(person => !person.npc && person.id===action.target && person.id!==id);
        if (!target || !world.voice(id) || !world.voice(target.id)) return 'Os dois jogadores precisam ativar a voz.';
        if (call || this.calls.has(target.id)) return 'Linha ocupada.';
        const next = {from:id,to:target.id,connected:false,expires:world.now+20_000};
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
      case 'game-start':
        if (this.playingPhoneGame(this.games.get(id))) return;
        this.games.set(id,{snake:createSnake(world.now),start:world.now,sampledAt:world.now,witnesses:new Set(gameplayWitnesses(world.players,player))});
        publishGameplay(world,player,'game-started');
        return;
      case 'game-stop':
        this.stopPhoneGame(player,world);
        return;
      case 'game-turn': {
        const game = this.games.get(id);
        if (game && action.direction) {
          if (game.snake.status==='ready') game.sampledAt = world.now;
          turnSnake(game.snake,action.direction,world.now);
        }
        return;
      }
    }
  }
}
