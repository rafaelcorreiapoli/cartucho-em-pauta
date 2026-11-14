export class VoiceEquipment {
  private active = new Set<number>();

  reset() { this.active.clear(); }
  deactivate(id:number) { this.active.delete(id); }

  toggle(id:number) {
    if (this.active.delete(id)) return 'Modulador desligado.';
    this.active.add(id);
    return 'Modulador ligado.';
  }

  view(id:number) { return {active:this.active.has(id)}; }
}
