import { ELECTION_RULES as rules, officeKeys, type Assignment, type CampaignAdvertisement, type ElectionView, type Elected, type Office } from '../src/elections';
import type { Contact } from '../src/politics';

type Candidate = Contact & {
  character:number;
  campaignNumber:number;
  office:Office; race:Office; advertised:boolean; spoke:boolean;
  interviewed:boolean; support?:string; scandal:number;
  noise:number; tie:number;
};
type Result = {cycle:number; offices:Elected[]; salaries:Map<string,number>; eliminated?:string};

export class ElectionCycle {
  private people = new Map<string,Candidate>();
  private paidDeputies = new Set<string>();
  private cycle = 1;
  private due = 0;
  private result?:Result;
  private previousPoll = new Map<string,number>();
  private nextPoll = 0;
  private broadcast?:{id:string; until:number};
  private availableAt = 0;
  private notice?:ElectionView['notice'];
  private seq = 0;
  private objected = false;
  private random = Math.random;

  reset(contacts:(Contact & {character?:number})[], now:number, random:()=>number) {
    this.people.clear();
    this.paidDeputies.clear();
    this.cycle = 1;
    this.due = now+rules.interval;
    this.result = this.broadcast = this.notice = undefined;
    this.availableAt = now;
    this.objected = false;
    this.random = random;
    this.previousPoll.clear();
    this.nextPoll = now;
    for (const contact of contacts) {
      this.people.set(contact.id,{...contact,character:contact.character ?? 0,campaignNumber:100+this.people.size,office:'deputy',race:'deputy',
        advertised:false,spoke:false,interviewed:false,scandal:0,noise:this.noise(),tie:random()});
    }
  }

  addDeputy(id:string) { this.paidDeputies.add(id); }

  private noise() { return (this.random()-.5)*4; }
  get currentCycle() { return this.cycle; }

  get eliminated() { return this.result?.eliminated; }
  office(id:string) { return this.people.get(id)?.office; }
  timeUntilRenewal(now:number) { return this.cycle<=rules.cycles ? this.due-now : Infinity; }
  open(now:number) { return this.cycle>rules.cycles || now<this.due; }
  speaker(now:number) { return this.broadcast && now<this.broadcast.until ? this.broadcast.id : undefined; }
  private announce(text:string) { this.notice = {seq:++this.seq,text}; }

  leave(id:string, now:number) {
    const previous = this.people.get(id);
    if (!previous) return;
    this.people.delete(id);
    if (this.broadcast?.id===id) this.stopBroadcast(now);
    for (const person of this.people.values()) if (person.support===id) person.support = undefined;
  }

  canCampaignAction(id:string,kind:'propaganda'|'discurso') {
    const person = this.people.get(id);
    return !!person && (kind==='propaganda' ? this.cycle<=rules.cycles && !person.advertised : !person.spoke);
  }

  remainingAdvertisements(id:string) {
    const person = this.people.get(id);
    return person ? Math.max(0,rules.cycles-this.cycle+1-Number(person.advertised)) : 0;
  }

  advertise(id:string, spend:(amount:number)=>boolean):CampaignAdvertisement | undefined {
    const person = this.people.get(id);
    if (person && this.cycle<=rules.cycles && !person.advertised && spend(rules.advertisementCost)) {
      person.advertised = true;
      return {name:person.name,character:person.character,number:person.campaignNumber};
    }
  }

  support(id:string, to:string) {
    const person = this.people.get(id);
    if (!person || to===id || (to && !this.people.has(to)) || person.support===(to || undefined)) return;
    person.support = to || undefined;
    this.announce(to ? `${person.name} declarou apoio a ${this.people.get(to)!.name}.` : `${person.name} retirou seu apoio eleitoral.`);
  }

  speech(id:string) {
    const person = this.people.get(id);
    if (!person || person.spoke) return false;
    person.spoke = true;
    this.announce(`${person.name} discursou na tribuna.`);
    return true;
  }

  canInterview(id:string, now:number) {
    return this.people.has(id) && !this.people.get(id)!.interviewed && !this.speaker(now) && now>=this.availableAt;
  }

  interview(id:string, now:number) {
    const person = this.people.get(id);
    if (!person || !this.canInterview(id,now)) return;
    person.interviewed = true;
    this.broadcast = {id,until:now+rules.interviewLength};
    this.availableAt = this.broadcast.until+rules.interviewGap;
    this.announce(`${person.name} está ao vivo na TV do Congresso.`);
  }

  stopBroadcast(now:number) {
    if (this.broadcast) this.availableAt = Math.max(this.availableAt,now+rules.interviewGap);
    this.broadcast = undefined;
  }

  scandal(id:string) {
    const person = this.people.get(id);
    if (person) {
      person.scandal = Math.min(10,person.scandal+4);
      this.announce(`Um escândalo envolvendo ${person.name} foi publicado.`);
    }
  }

  object(id:string) {
    if (this.objected || !this.office(id)) return false;
    this.objected = true;
    this.announce(`${this.people.get(id)!.name} contestou o projeto em pauta.`);
    return true;
  }

  canObject(id:string) { return !!this.office(id) && !this.objected; }

  private strength(person:Candidate, popularity:(id:string)=>number,advertisementMultiplier:number) {
    const support = [...this.people.values()].filter(other => other.support===person.id).length;
    return Math.max(1,popularity(person.id)+
      (person.advertised ? rules.advertisementStrength*advertisementMultiplier : 0)+(person.spoke ? 4 : 0)+(person.interviewed ? 8 : 0)+
      Math.min(12,support*4)-person.scandal);
  }

  private tallyScore(person:Candidate, popularity:(id:string)=>number,advertisementMultiplier:number) {
    return this.strength(person,popularity,advertisementMultiplier)+person.noise;
  }

  private rank(popularity:(id:string)=>number,advertisementMultiplier:number) {
    const score = (person:Candidate) => this.tallyScore(person,popularity,advertisementMultiplier);
    return [...this.people.values()].sort((a,b) => score(b)-score(a) || a.tie-b.tie || a.id.localeCompare(b.id));
  }

  private polls(popularity:(id:string)=>number,advertisementMultiplier:number) {
    return officeKeys.flatMap(race => {
      const group = [...this.people.values()].filter(person => person.race===race);
      const estimates = group.map(person => ({person,score:Math.max(1,this.strength(person,popularity,advertisementMultiplier)-person.noise)}));
      const sum = estimates.reduce((total,{score}) => total+score,0);
      return estimates.sort((a,b) => b.score-a.score || a.person.tie-b.person.tie).map(({person,score}) => {
        const estimate = Math.round(score/sum*100);
        return {id:person.id,name:person.name,character:person.character,race,estimate,trend:estimate-(this.previousPoll.get(person.id) ?? estimate),supports:person.support};
      });
    });
  }

  advance(now:number,popularity:(id:string)=>number,settle:(ids:string[])=>Map<string,number>,advertisementMultiplier=1) {
    if (now>=this.due && this.cycle<=rules.cycles) {
      const ranked = this.rank(popularity,advertisementMultiplier);
      const scores = ranked.map(person=>Math.max(.01,this.tallyScore(person,popularity,advertisementMultiplier)));
      const total = scores.reduce((sum,score)=>sum+score,0);
      const eliminated = ranked.length>rules.minimumMandates ? ranked.at(-1) : undefined;
      if (eliminated) this.leave(eliminated.id,now);
      const offices = ranked.map((person,index)=>({id:person.id,name:person.name,character:person.character,
        office:person.office,race:person.race,percentage:Math.round(100*scores[index]/total)}));
      this.announce(eliminated ? `${eliminated.name} perdeu o mandato.` : 'Renovação concluída. Mandatos preservados.');
      this.objected = false;
      for (const person of this.people.values()) {
        person.scandal = 0;
        person.advertised = person.spoke = person.interviewed = false;
        person.support = undefined;
        person.noise = this.noise();
      }
      const salaries = settle([...this.people.keys(),...this.paidDeputies]);
      this.result = {cycle:this.cycle,offices,salaries,eliminated:eliminated?.id};
      this.cycle++;
      this.due += rules.interval;
      this.previousPoll.clear();
      this.nextPoll = now;
    }
    if (now>=this.nextPoll) {
      this.previousPoll = new Map(this.polls(popularity,advertisementMultiplier).map(({id,estimate}) => [id,estimate]));
      this.nextPoll = now+25_000;
    }
  }

  private assignments():Assignment[] {
    return [...this.people.values()].map(({id,name,office}) => ({id,name,office}))
      .sort((a,b) => officeKeys.indexOf(a.office)-officeKeys.indexOf(b.office));
  }

  view(id:string, now:number, popularity:(id:string)=>number, canCampaign:boolean, objection?:string,advertisementMultiplier=1):ElectionView {
    const person = this.people.get(id);
    const speaker = this.speaker(now);
    return {
      cycle:this.cycle,remaining:Math.max(0,Math.ceil(((this.cycle<=rules.cycles ? this.due : now)-now)/1000)),
      mandate:!!person,offices:this.assignments(),polls:this.polls(popularity,advertisementMultiplier),
      personal:person && {office:person.office,race:person.race,advertised:person.advertised,
        spoke:person.spoke,interviewed:person.interviewed,salary:rules.salary},
      result:this.result && {cycle:this.result.cycle,offices:this.result.offices,
        eliminated:this.result.eliminated,expectedSalary:this.people.has(id) ? rules.salary : 0,salary:this.result.salaries.get(id) ?? 0},
      broadcast:speaker && this.broadcast ? {id:speaker,name:this.people.get(speaker)!.name,
        remaining:Math.ceil((this.broadcast.until-now)/1000)} : undefined,
      notice:this.notice,objection,canObject:!objection && this.canObject(id),canCampaign:canCampaign && !!person,canInterview:canCampaign && this.canInterview(id,now),
    };
  }
}
