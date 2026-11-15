import { stationRecharge, type RechargeStation } from '../src/station-recharge';

export class StationCooldowns {
  private readonly readyAt = new Map<RechargeStation,number>();

  reset() { this.readyAt.clear(); }

  remaining(station:RechargeStation, now:number) {
    return Math.max(0,(this.readyAt.get(station) ?? now)-now);
  }

  take(station:RechargeStation, now:number) {
    if (this.remaining(station,now)>0) return false;
    this.readyAt.set(station,now+stationRecharge[station].duration);
    return true;
  }

  view(now:number):Partial<Record<RechargeStation,number>> {
    const active:Partial<Record<RechargeStation,number>> = {};
    for (const station of this.readyAt.keys()) {
      const remaining = this.remaining(station,now);
      if (remaining>0) active[station] = remaining;
    }
    return active;
  }
}
