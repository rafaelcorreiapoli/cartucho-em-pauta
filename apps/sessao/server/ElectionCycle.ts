import { ELECTION_RULES as rules, offices, officeKeys, type Assignment, type ElectionView, type Office } from '../src/elections';
import type { Contact } from '../src/politics';

type Candidate = Contact & {
  character:number;
  office:Office; race:Office; invested:number; advertised:boolean; spoke:boolean;
  interviewed:boolean; support?:string; incumbent:number; scandal:number;
  noise:number; tie:number; payStarted:number; accrued:number;
};
type Result = {cycle:number; offices:Assignment[]; previous:Map<string,Office>; salaries:Map<string,number>};

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
    const pool = [...contacts];
    const senators = this.senateSeats(pool.length);
    for (let i=0;pool.length;i++) {
      const contact = pool.splice(Math.floor(random()*pool.length),1)[0];
      const office = i===0 ? 'president' : i<=senators ? 'senator' : 'deputy';
      this.people.set(contact.id,{...contact,character:contact.character ?? 0,office,race:office,invested:0,advertised:false,spoke:false,
        interviewed:false,incumbent:0,scandal:0,noise:this.noise(),tie:random(),payStarted:now,accrued:0});
    }
  }

  private senateSeats(count:number) { return Math.min(Math.floor(count/3),Math.max(0,count-2)); }
  private noise() { return (this.random()-.5)*4; }
  get number() { return this.cycle; }
  office(id:string) { return this.people.get(id)?.office; }
  registrationOpen(now:number) { return now<this.due-rules.registrationLock; }
  open(now:number) { return now<this.due; }
  speaker(now:number) { return this.broadcast && now<this.broadcast.until ? this.broadcast.id : undefined; }
  private announce(text:string) { this.notice = {seq:++this.seq,text}; }

  leave(id:string, now:number) {
    const previous = this.people.get(id);
    if (!previous) return;
    this.people.delete(id);
    if (this.broadcast?.id===id) this.stopBroadcast(now);
    for (const person of this.people.values()) if (person.support===id) person.support = undefined;
    if (previous.office==='president' && this.people.size) {
      const replacement = [...this.people.values()].find(person => person.office==='senator') ?? this.people.values().next().value!;
      this.changeInterim(replacement,'president',now);
      this.announce(`${replacement.name} assume a Presidência interinamente.`);
    }
    if ([...this.people.values()].filter(person => person.office==='senator').length<this.senateSeats(this.people.size)) {
      const replacement = [...this.people.values()].find(person => person.office==='deputy');
      if (replacement) this.changeInterim(replacement,'senator',now);
    }
  }

  private changeInterim(person:Candidate, office:Office, now:number) {
    person.accrued += (now-person.payStarted)*offices[person.office].salary/rules.interval;
    person.payStarted = now;
    person.office = office;
  }

  run(id:string, office:Office, now:number) {
    const person = this.people.get(id);
    if (person && this.registrationOpen(now)) person.race = office;
  }

  invest(id:string, amount:number, spend:(amount:number)=>boolean) {
    const person = this.people.get(id);
    if (person && amount>0 && person.invested+amount<=rules.investmentCap && spend(amount)) person.invested += amount;
  }

  advertise(id:string, spend:(amount:number)=>boolean) {
    const person = this.people.get(id);
    if (person && !person.advertised && spend(rules.advertisementCost)) {
      person.advertised = true;
      this.announce(`${person.name} colocou propaganda no ar.`);
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
    if (this.objected || this.office(id)!=='president') return false;
    this.objected = true;
    this.announce(`${this.people.get(id)!.name} contestou o projeto em pauta.`);
    return true;
  }

  canObject(id:string) { return this.office(id)==='president' && !this.objected; }

  private strength(person:Candidate, popularity:(id:string)=>number) {
    const support = [...this.people.values()].filter(other => other.support===person.id).length;
    return Math.max(1,popularity(person.id)+5*Math.sqrt(person.invested)+
      (person.advertised ? 5 : 0)+(person.spoke ? 4 : 0)+(person.interviewed ? 8 : 0)+
      Math.min(12,support*4)-person.scandal-Math.min(8,person.incumbent*4));
  }

  private rank(popularity:(id:string)=>number) {
    const score = (person:Candidate) => this.strength(person,popularity)+person.noise;
    return [...this.people.values()].sort((a,b) => score(b)-score(a) || a.tie-b.tie || a.id.localeCompare(b.id));
  }

  private polls(popularity:(id:string)=>number) {
    return officeKeys.flatMap(race => {
      const group = [...this.people.values()].filter(person => person.race===race);
      const estimates = group.map(person => ({person,score:Math.max(1,this.strength(person,popularity)-person.noise)}));
      const sum = estimates.reduce((total,{score}) => total+score,0);
      return estimates.sort((a,b) => b.score-a.score || a.person.tie-b.person.tie).map(({person,score}) => {
        const estimate = Math.round(score/sum*100);
        return {id:person.id,name:person.name,character:person.character,race,estimate,trend:estimate-(this.previousPoll.get(person.id) ?? estimate),supports:person.support};
      });
    });
  }

  advance(now:number, popularity:(id:string)=>number, pay:(id:string, amount:number)=>void) {
    if (now>=this.due && this.people.size) {
      const previous = new Map<string,Office>(), salaries = new Map<string,number>();
      const ranked = this.rank(popularity);
      const president = ranked.find(person => person.race==='president') ?? ranked[0];
      const rest = ranked.filter(person => person!==president);
      const senate = new Set([...rest.filter(person => person.race==='senator'),...rest.filter(person => person.race!=='senator')]
        .slice(0,this.senateSeats(ranked.length)));
      for (const person of ranked) {
        previous.set(person.id,person.office);
        const salary = Math.floor(person.accrued+(this.due-person.payStarted)*offices[person.office].salary/rules.interval);
        salaries.set(person.id,salary);
        pay(person.id,salary);
        const office = person===president ? 'president' : senate.has(person) ? 'senator' : 'deputy';
        person.incumbent = office===person.office ? person.incumbent+1 : 0;
        person.office = person.race = office;
        person.invested = person.scandal = person.accrued = 0;
        person.advertised = person.spoke = person.interviewed = false;
        person.support = undefined;
        person.noise = this.noise();
        person.payStarted = this.due;
      }
      this.result = {cycle:this.cycle,previous,salaries,offices:this.assignments()};
      this.announce(`Eleição ${this.cycle}: ${president.name} assume a Presidência.`);
      this.cycle++;
      this.due += rules.interval;
      this.objected = false;
      this.previousPoll.clear();
      this.nextPoll = now;
    }
    if (now>=this.nextPoll) {
      this.previousPoll = new Map(this.polls(popularity).map(({id,estimate}) => [id,estimate]));
      this.nextPoll = now+25_000;
    }
  }

  private assignments():Assignment[] {
    return [...this.people.values()].map(({id,name,office}) => ({id,name,office}))
      .sort((a,b) => officeKeys.indexOf(a.office)-officeKeys.indexOf(b.office));
  }

  view(id:string, now:number, popularity:(id:string)=>number, canCampaign:boolean, objection?:string):ElectionView {
    const person = this.people.get(id);
    const speaker = this.speaker(now);
    return {
      cycle:this.cycle,remaining:Math.max(0,Math.ceil((this.due-now)/1000)),
      registrationOpen:this.registrationOpen(now),offices:this.assignments(),polls:this.polls(popularity),
      personal:person && {office:person.office,race:person.race,invested:person.invested,advertised:person.advertised,
        spoke:person.spoke,interviewed:person.interviewed,salary:offices[person.office].salary},
      result:this.result && {cycle:this.result.cycle,offices:this.result.offices,
        previous:this.result.previous.get(id),salary:this.result.salaries.get(id) ?? 0},
      broadcast:speaker && this.broadcast ? {id:speaker,name:this.people.get(speaker)!.name,
        remaining:Math.ceil((this.broadcast.until-now)/1000)} : undefined,
      notice:this.notice,objection,canObject:!objection && this.canObject(id),canCampaign:canCampaign && !!person,canInterview:canCampaign && this.canInterview(id,now),
    };
  }
}
