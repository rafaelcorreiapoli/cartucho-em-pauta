import { ELECTION_RULES as rules, officeKeys, advertisements, type Advertisement, type Assignment, type CampaignAdvertisement, type ElectionView, type Elected, type Office } from '../src/elections';
import type { Contact } from '../src/politics';

type Candidate = Contact & {
  character:number;
  campaignNumber:number;
  office:Office; race:Office; advertisementPopularity:number; spoke:boolean;
  interviewed:boolean; scandal:number;
  noise:number; tie:number;
};
type Result = {cycle:number; offices:Elected[]; eliminated?:string};

export class ElectionCycle {
  private people = new Map<string,Candidate>();
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
        advertisementPopularity:0,spoke:false,interviewed:false,scandal:0,noise:this.noise(),tie:random()});
    }
  }

  mandateIds() { return this.people.keys(); }

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
  }

  canCampaignAction(id:string,kind:'propaganda'|'discurso') {
    const person = this.people.get(id);
    return !!person && (kind==='propaganda' ? this.cycle<=rules.cycles : !person.spoke);
  }

  hasFutureAdvertising(id:string,now:number) {
    return this.people.has(id) && this.cycle<=rules.cycles &&
      now<this.due+(rules.cycles-this.cycle)*rules.interval;
  }

  advertise(id:string, spend:(amount:number)=>boolean, format:Advertisement='spot') {
    const person = this.people.get(id);
    const offer = advertisements[format];
    if (person && this.cycle<=rules.cycles && spend(offer.cost)) {
      person.advertisementPopularity += offer.popularity;
      const broadcast:CampaignAdvertisement = {name:person.name,character:person.character,number:person.campaignNumber};
      return {broadcast,offer};
    }
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
    return Math.max(1,popularity(person.id)+
      person.advertisementPopularity*(advertisementMultiplier-1)+(person.spoke ? 4 : 0)+(person.interviewed ? 8 : 0)-person.scandal);
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
        return {id:person.id,name:person.name,character:person.character,race,estimate,trend:estimate-(this.previousPoll.get(person.id) ?? estimate)};
      });
    });
  }

  advance(now:number,popularity:(id:string)=>number,advertisementMultiplier=1) {
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
        person.advertisementPopularity = 0;
        person.spoke = person.interviewed = false;
        person.noise = this.noise();
      }
      this.result = {cycle:this.cycle,offices,eliminated:eliminated?.id};
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
      personal:person && {office:person.office,race:person.race,advertised:person.advertisementPopularity>0,
        spoke:person.spoke,interviewed:person.interviewed},
      result:this.result && {cycle:this.result.cycle,offices:this.result.offices,
        eliminated:this.result.eliminated},
      broadcast:speaker && this.broadcast ? {id:speaker,name:this.people.get(speaker)!.name,
        remaining:Math.ceil((this.broadcast.until-now)/1000)} : undefined,
      notice:this.notice,objection,canObject:!objection && this.canObject(id),canCampaign:canCampaign && !!person,canInterview:canCampaign && this.canInterview(id,now),
    };
  }
}
