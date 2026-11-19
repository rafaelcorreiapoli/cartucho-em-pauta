import { levelThresholds, type AttributePoints, type AttributeRequest, type Progression } from '../src/progression';

export class CharacterProgression {
  private xp = 0;
  private revision = 0;
  private bonusPoints = 0;
  grantPoints(amount:number) { this.bonusPoints += amount; }
  private invested:AttributePoints = {agility:0,stamina:0};

  constructor(private readonly matchId:number) {}

  earn(xp:number) { this.xp += xp; }

  private get level() {
    return levelThresholds.filter(threshold=>this.xp>=threshold).length;
  }

  private get available() { return this.level-1+this.bonusPoints-this.revision; }

  allocate(request:AttributeRequest) {
    if (request.matchId!==this.matchId || request.revision!==this.revision || !this.available ||
        !Object.hasOwn(this.invested,request.attribute)) return false;
    this.invested[request.attribute]++;
    this.revision++;
    return true;
  }

  view():Progression {
    const level = this.level;
    return {xp:this.xp,level,levelStart:levelThresholds[level-1],nextLevelXp:levelThresholds[level],
      available:this.available,invested:{...this.invested},revision:this.revision,matchId:this.matchId};
  }
}
