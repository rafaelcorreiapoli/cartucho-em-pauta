import { voiceBattery, voiceRecharge } from '../src/equipment';

export class VoiceEquipment {
  private cycles = new Map<string,{until:number; readyAt:number}>();

  reset() { this.cycles.clear(); }
  leave(id:string) { this.cycles.delete(id); }

  deactivate(id:string, now:number) {
    const cycle = this.cycles.get(id);
    if (cycle && cycle.until>now) {
      cycle.until = now;
      cycle.readyAt = now+voiceRecharge;
    }
  }

  toggle(id:string, now:number) {
    const cycle = this.cycles.get(id);
    if (cycle && cycle.until>now) {
      this.deactivate(id,now);
      return 'Modulador desligado.';
    }
    if (cycle && cycle.readyAt>now) return 'Modulador recarregando.';
    const until = now+voiceBattery;
    this.cycles.set(id,{until,readyAt:until+voiceRecharge});
    return 'Modulador ligado.';
  }

  view(id:string, now:number) {
    const cycle = this.cycles.get(id);
    return {active:!!cycle && cycle.until>now,
      battery:cycle ? Math.max(0,Math.ceil((cycle.until-now)/1000)) : voiceBattery/1000,
      recharge:cycle && cycle.until<=now ? Math.max(0,Math.ceil((cycle.readyAt-now)/1000)) : 0};
  }
}
