import {powerRules,type PowerAction,type PowerPanel,type PowerView} from '../src/power';

export class Power {
  active = false;
  private readyAt = 0;
  private operators:[string?,string?] = [];
  private repairAt?:number;

  canSabotage(now:number) {
    return !this.active && now>=this.readyAt;
  }

  act(id:string,{kind,panel}:PowerAction,now:number) {
    if (kind==='sabotage') {
      if (panel!==0 || !this.canSabotage(now)) return;
      this.active = true;
      return 'Energia cortada.';
    }
    if (!this.active) return;
    if (kind==='cancel') {
      if (this.operators[panel]!==id) return;
      this.release(panel);
      return 'Painel liberado.';
    }
    if (this.operators[panel] || this.operators.includes(id)) return;
    this.operators[panel] = id;
    if (this.operators[0] && this.operators[1]) this.repairAt = now+powerRules.repairMs;
    return 'Painel acionado. Permaneça ao lado dele até o reparo terminar.';
  }

  private release(panel:PowerPanel) {
    this.operators[panel] = undefined;
    this.repairAt = undefined;
  }

  remove(id:string) {
    for (const panel of [0,1] as const) {
      if (this.operators[panel]===id) this.release(panel);
    }
  }

  advance(now:number,eligible:(id:string,panel:PowerPanel)=>boolean) {
    if (!this.active) return;
    for (const panel of [0,1] as const) {
      const id = this.operators[panel];
      if (id && !eligible(id,panel)) this.release(panel);
    }
    if (this.repairAt===undefined || now<this.repairAt) return;
    this.active = false;
    this.operators = [];
    this.repairAt = undefined;
    this.readyAt = now+powerRules.cooldownMs;
  }

  view(id:string,now:number,paused:boolean):PowerView|undefined {
    if (!this.active) return;
    return {
      occupied:[!!this.operators[0],!!this.operators[1]],
      operating:this.operators[0]===id ? 0 : this.operators[1]===id ? 1 : undefined,
      seconds:this.repairAt===undefined ? undefined : Math.max(1,Math.ceil((this.repairAt-now)/1000)),
      paused,
    };
  }
}
