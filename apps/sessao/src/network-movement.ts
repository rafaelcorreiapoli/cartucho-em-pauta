import type { Player } from './map';
import { applyInput, type ControlState, type MovementInput } from './movement';

const HISTORY_MS = 100;

export class PredictedMovement {
  private pending: MovementInput[] = [];
  private seq = 0;
  state?: ControlState;

  constructor(private send: (input: MovementInput) => void) {}

  input(command: Omit<MovementInput,'seq'>) {
    if (!this.state || this.pending.length >= 20) return;
    const input = {seq:++this.seq,...command,plenary:this.state.plenary};
    this.pending.push(input);
    applyInput(this.state,input);
    this.send(input);
  }

  reconcile(snapshot: ControlState) {
    this.seq = Math.max(this.seq,snapshot.ack);
    if (!!this.state?.isolated!==!!snapshot.isolated) this.pending = [];
    else this.pending = this.pending.filter(input => input.seq>snapshot.ack && !!input.plenary===!!snapshot.plenary);
    this.state = {...snapshot,player:{...snapshot.player},route:[...snapshot.route]};
    for (const input of this.pending) applyInput(this.state,input);
  }
}

export class PlayerHistory {
  private snapshots: {at:number; players:Player[]}[] = [];

  clear() { this.snapshots = []; }

  add(players: Player[], at: number) {
    this.snapshots.push({at,players});
    if (this.snapshots.length>8) this.snapshots.shift();
  }

  sample(now: number, id: string) {
    const at = now-HISTORY_MS;
    const after = this.snapshots.findIndex(snapshot => snapshot.at>=at);
    const first = this.snapshots[Math.max(0,after-1)];
    const second = this.snapshots[after];
    if (!second) return this.snapshots.at(-1)?.players.find(player => player.id===id);
    const from = first.players.find(player => player.id===id);
    const to = second.players.find(player => player.id===id);
    if (!from || !to || first===second) return to ?? from;
    const ratio = Math.min(1,Math.max(0,(at-first.at)/Math.max(1,second.at-first.at)));
    return {
      ...to,
      x:from.x+(to.x-from.x)*ratio,
      y:from.y+(to.y-from.y)*ratio,
      moving:from.x!==to.x || from.y!==to.y || to.moving,
    };
  }
}
