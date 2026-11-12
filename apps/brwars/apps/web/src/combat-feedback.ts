/** Presentation only: simulation damage stays authoritative and simultaneous. */
export class PendingImpacts {
  private damage = new Map<number, number>();
  add(id: number, damage: number) {
    this.damage.set(id, (this.damage.get(id) ?? 0) + damage);
  }
  resolve(id: number, damage: number) {
    const remaining = (this.damage.get(id) ?? 0) - damage;
    if (remaining > 0.001) this.damage.set(id, remaining);
    else this.damage.delete(id);
  }
  has(id: number) {
    return this.damage.has(id);
  }
  health(id: number, hp: number, maxHp: number) {
    return Math.min(maxHp, hp + (this.damage.get(id) ?? 0));
  }
  clear() {
    this.damage.clear();
  }
}
export const ATTACK_FRAME_RATE = 7;
export const ATTACK_RELEASE_MS = 1000 / ATTACK_FRAME_RATE;
