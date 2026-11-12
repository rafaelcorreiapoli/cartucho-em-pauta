import type { GameplayEvent } from '../src/gameplay';
import { agendas, AGENDA_REWARD, CABINET_GRANT, CAMPAIGN_COST, HEARING_POPULARITY, PAYMENTS_PER_ROUND, type Agenda, type Contact, type DirectoryContact,
  type Evidence, type Mission, type Offer, type PoliticsView, type Split } from '../src/politics';
import type { Vote } from '../src/plenary';

type Account = {
  wallet:number; walletIncome:number; popularity:number; missions:Mission[]; completed:Mission[]; missionDeck:Agenda[]; missionsPaid:boolean; nextMissionId:number; grantUsed:boolean; campaignRound:number; auditRound:number; audits:number; expenses:{kind:string; amount:number; cycle:number}[]; paymentRound:number; payments:number;
  missionPayers:Set<string>; missionCoffee:Set<string>; known:Set<number>; suspended:boolean;
};
const activityMissions = {
  protocolo:(event:GameplayEvent) => event.type==='filed',
  sigilo:(event:GameplayEvent) => event.type==='dropped' && !event.witnesses.length,
  joguinho:(event:GameplayEvent) => event.type==='game-won' && !event.witnesses.length,
  fotografia:(event:GameplayEvent) => event.type==='photo' && event.witnesses.length>0,
} satisfies Partial<Record<Agenda,(event:GameplayEvent)=>boolean>>;
const missionTargets:Record<Agenda,number> = {
  protocolo:1, entrega:3, sigilo:1, joguinho:1, fotografia:1,
  fortuna:12, campanha:65, articulacao:2, projetos:2, oposicao:2, escandalo:1, auditoria:1, emenda:1, votacao:1, cafe:1, leitura:1, credencial:1,
};
const activeMissionCount = 3;
const cap = (value:number) => Math.max(0,Math.min(100,value));

export class PoliticalEconomy {
  private accounts = new Map<string,Account>();
  private contacts = new Map<string,DirectoryContact>();
  private records = new Map<number,Evidence>();
  private published = new Set<number>();
  private offers = new Map<number,Offer>();
  private serial = 0;

  reset(contacts:DirectoryContact[], random:()=>number) {
    this.contacts = new Map(contacts.map(contact => [contact.id,contact]));
    this.accounts.clear();
    this.records.clear();
    this.published.clear();
    this.offers.clear();
    this.serial = 0;
    const deck = (Object.keys(agendas) as Agenda[]).filter(kind =>
      kind!=='cafe' && kind!=='entrega' && !Object.hasOwn(activityMissions,kind) && (contacts.length>=3 || (kind!=='articulacao' && kind!=='escandalo')));
    for (const contact of contacts) {
      const offset = Math.floor(random()*deck.length);
      const ordered = [...deck.slice(offset),...deck.slice(0,offset)];
      const account:Account = {
        wallet:8,walletIncome:0,popularity:40,missions:[],completed:[],missionDeck:['cafe',...ordered.slice(0,2),'protocolo','sigilo','joguinho',...ordered.slice(2),
          ...(contacts.length>1 ? ['fotografia'] as const : []),...(contacts.length>=4 ? ['entrega'] as const : [])],
        missionsPaid:false,nextMissionId:0,missionPayers:new Set(),missionCoffee:new Set(),
        grantUsed:false,campaignRound:-1,auditRound:-1,audits:0,expenses:[],paymentRound:-1,payments:0,
        known:new Set(),suspended:false,
      };
      this.fillMissions(account);
      this.accounts.set(contact.id,account);
    }
  }

  popularity(id:string) { return this.accounts.get(id)?.popularity ?? 0; }

  changePopularity(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (!account) return;
    account.popularity = cap(account.popularity+amount);
    this.progressMissions(account);
  }

  private credit(account:Account, amount:number) {
    account.wallet += amount;
    account.walletIncome += amount;
  }

  earn(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (!account) return;
    this.credit(account,amount);
    this.progressMissions(account);
  }

  spendOnElection(id:string, amount:number, kind:string, cycle:number) {
    const account = this.accounts.get(id);
    if (!account || amount>account.wallet) return false;
    account.wallet -= amount;
    account.expenses.push({kind,amount,cycle});
    return true;
  }

  name(id:string) { return this.contacts.get(id)?.name ?? 'Jogador'; }
  suspended(id:string) { return this.accounts.get(id)?.suspended ?? false; }
  canCall(id:string) { return (this.accounts.get(id)?.popularity ?? 0)>=HEARING_POPULARITY && !this.suspended(id); }
  cancelOffers(id?:string) {
    for (const [key,offer] of this.offers) if (!id || offer.from===id || offer.to===id) this.offers.delete(key);
  }

  private record(kind:Evidence['kind'], from:string, amount:number, round:number, to?:string) {
    const id = ++this.serial;
    this.records.set(id,{id,kind,from,to,amount,round});
    this.accounts.get(from)?.known.add(id);
    if (to) this.accounts.get(to)?.known.add(id);
    if (kind==='public-transfer') this.published.add(id);
  }

  transfer(from:string, to:string, amount:number, clandestine:boolean, round:number) {
    const source = this.accounts.get(from), recipient = this.accounts.get(to);
    if (!source || !recipient || from===to || !Number.isSafeInteger(amount) || amount<1 || amount>source.wallet) return false;
    if (source.paymentRound!==round) {
      source.paymentRound = round;
      source.payments = 0;
    }
    if (source.payments>=PAYMENTS_PER_ROUND) return false;
    source.payments++;
    source.wallet -= amount;
    this.credit(recipient,amount);
    if (recipient.missions.some(mission => mission.kind==='articulacao')) recipient.missionPayers.add(from);
    this.progressMissions(recipient);
    this.record(clandestine ? 'clandestine-transfer' : 'public-transfer',from,amount,round,to);
    return true;
  }

  grant(id:string, diverted:Split, budget:number, round:number) {
    const account = this.accounts.get(id);
    if (!account || account.grantUsed || account.suspended || budget<CABINET_GRANT) return;
    account.grantUsed = true;
    this.credit(account,diverted);
    this.progressMissions(account);
    if (diverted>0) this.record('diversion',id,diverted,round);
    return {budget:CABINET_GRANT,stability:(CABINET_GRANT-diverted)*2-diverted};
  }

  campaign(id:string, round:number) {
    const account = this.accounts.get(id);
    if (!account || account.wallet<CAMPAIGN_COST || account.campaignRound===round) return;
    account.wallet -= CAMPAIGN_COST;
    account.campaignRound = round;
    this.changePopularity(id,17);
  }

  audit(id:string, round:number, limit=1) {
    const account = this.accounts.get(id);
    if (!account) return;
    this.recordActivity(id,'auditoria');
    if (account.auditRound!==round) {
      account.auditRound = round;
      account.audits = 0;
    }
    if (account.audits>=limit) return 'Você já atingiu o limite de documentos desta rodada.';
    // Larger diversions are easier to uncover; an audit surfaces one new document.
    const candidate = [...this.records.values()].filter(record => record.kind!=='public-transfer' &&
      !account.known.has(record.id) && !this.published.has(record.id))
      .sort((a,b) => b.amount-a.amount || b.id-a.id)[0];
    if (!candidate) return 'Nenhum registro novo nesta auditoria.';
    account.known.add(candidate.id);
    account.audits++;
    return 'Documento encontrado. Confira seu dossiê.';
  }

  share(from:string, to:string, evidence:number, price:number) {
    const seller = this.accounts.get(from), recipient = this.accounts.get(to);
    if (!seller?.known.has(evidence) || !recipient || recipient.known.has(evidence) ||
      this.published.has(evidence) || !Number.isSafeInteger(price) || price<0) return;
    if (price===0) {
      recipient.known.add(evidence);
      return;
    }
    this.cancelOutgoing(from);
    const id = ++this.serial;
    this.offers.set(id,{id,evidence,from,to,price});
  }

  private cancelOutgoing(id:string) {
    for (const [key,offer] of this.offers) if (offer.from===id) this.offers.delete(key);
  }

  offer(id:number) { return this.offers.get(id); }

  accept(buyer:string, id:number, round:number) {
    const offer = this.offers.get(id);
    if (!offer || offer.to!==buyer || this.published.has(offer.evidence) ||
      this.accounts.get(buyer)?.known.has(offer.evidence)) return;
    if (!this.transfer(buyer,offer.from,offer.price,true,round)) return;
    this.accounts.get(buyer)?.known.add(offer.evidence);
    this.offers.delete(id);
  }

  cancel(by:string, id:number) {
    const offer = this.offers.get(id);
    if (offer && (offer.from===by || offer.to===by)) this.offers.delete(id);
  }

  publish(id:string, evidence:number, president?:string) {
    const account = this.accounts.get(id), record = this.records.get(evidence);
    if (!account?.known.has(evidence) || !record || this.published.has(evidence)) return;
    this.published.add(evidence);
    for (const [key,offer] of this.offers) if (offer.evidence===evidence) this.offers.delete(key);
    const subject = this.accounts.get(record.from);
    if (subject) subject.popularity = cap(subject.popularity-(record.kind==='diversion' ? 6+record.amount*4 : 8)-(record.from===president ? 4 : 0));
    if (record.to) {
      const receiver = this.accounts.get(record.to);
      if (receiver) receiver.popularity = cap(receiver.popularity-5);
    }
    if (id!==record.from && id!==record.to) {
      account.popularity = cap(account.popularity+10);
      this.progressMissions(account,{escandalo:1});
    }
    return record;
  }

  billResult(votes:Map<string,Vote>, passed:boolean, popular:boolean) {
    for (const [id,vote] of votes) {
      const account = this.accounts.get(id);
      if (!account) continue;
      if (passed && vote==='yes') {
        account.popularity = cap(account.popularity+(popular ? 8 : -5));
      }
      this.progressMissions(account,{
        votacao:1,projetos:Number(passed && vote==='yes'),oposicao:Number(!passed && vote==='no'),
      });
    }
  }

  suspend(id:string) {
    const account = this.accounts.get(id);
    if (account) {
      account.suspended = true;
      account.popularity = cap(account.popularity-20);
    }
  }

  recordGameplay(event:GameplayEvent) {
    const account = this.accounts.get(event.actor);
    if (!account) return;
    const gains:Partial<Record<Agenda,number>> = {};
    for (const [mission,matches] of Object.entries(activityMissions)) {
      if (matches(event)) gains[mission as Agenda] = 1;
    }
    if (event.kind==='coffee') {
      if (event.type==='used') gains.cafe = 1;
      if (event.type==='transferred' && event.target && account.missions.some(mission=>mission.kind==='entrega')) {
        account.missionCoffee.add(event.target);
      }
    }
    this.progressMissions(account,gains);
  }

  recordActivity(id:string, kind:'auditoria' | 'cafe' | 'leitura' | 'credencial' | 'emenda') {
    const account = this.accounts.get(id);
    if (account) this.progressMissions(account,{[kind]:1});
  }

  private fillMissions(account:Account) {
    while (account.missions.length<activeMissionCount) {
      const index = account.missionDeck.findIndex(kind => !account.missions.some(mission => mission.kind===kind) &&
        (kind!=='campanha' || account.popularity<100));
      const [kind] = account.missionDeck.splice(index,1);
      account.missionDeck.push(kind);
      let target = missionTargets[kind];
      if (kind==='fortuna') target = Math.max(target,account.wallet+4);
      if (kind==='campanha') target = Math.min(100,Math.max(target,account.popularity+15));
      if (kind==='articulacao') account.missionPayers.clear();
      if (kind==='entrega') account.missionCoffee.clear();
      account.missions.push({id:++account.nextMissionId,kind,current:0,target});
    }
  }

  private missionProgress(account:Account, mission:Mission) {
    if (mission.kind==='fortuna') return account.wallet;
    if (mission.kind==='campanha') return account.popularity;
    if (mission.kind==='articulacao') return account.missionPayers.size;
    if (mission.kind==='entrega') return account.missionCoffee.size;
    return mission.current;
  }

  private progressMissions(account:Account, gains:Partial<Record<Agenda,number>> = {}) {
    for (const mission of account.missions) {
      const current = this.missionProgress(account,mission)+(gains[mission.kind] ?? 0);
      mission.current = Math.min(current,mission.target);
      if (current>=mission.target) account.completed.push({...mission});
    }
    account.missions = account.missions.filter(mission => mission.current<mission.target);
    this.fillMissions(account);
  }

  settleAgendas(players:Iterable<string>) {
    for (const id of players) {
      const account = this.accounts.get(id);
      if (!account || account.missionsPaid) continue;
      for (const mission of account.missions) mission.current = this.missionProgress(account,mission);
      account.missionsPaid = true;
      this.credit(account,AGENDA_REWARD*account.completed.length);
    }
  }

  view(id:string, contacts:Contact[], round:number, canCallHearing:boolean, eligible:(id:string) => boolean): PoliticsView | undefined {
    const account = this.accounts.get(id);
    if (!account) return;
    const {wallet,walletIncome,popularity,grantUsed,suspended} = account;
    return {
      wallet,walletIncome,popularity,grantUsed,suspended,campaigned:account.campaignRound===round,
      missions:{
        active:account.missions.map(mission => ({...mission,current:account.missionsPaid ? mission.current : this.missionProgress(account,mission)})),
        completed:account.completed.slice(),paid:account.missionsPaid,
      },
      canCallHearing:canCallHearing && this.canCall(id),contacts,
      paymentsLeft:PAYMENTS_PER_ROUND-(account.paymentRound===round ? account.payments : 0),
      directory:[...this.contacts.values()].map(contact => ({
        ...contact,popularity:this.accounts.get(contact.id)!.popularity,eligible:eligible(contact.id),
      })),
      evidence:[...account.known].filter(key => !this.published.has(key)).map(key => this.records.get(key)!),
      ledger:[...this.published].map(key => this.records.get(key)!),
      incoming:[...this.offers.values()].filter(offer => offer.to===id),
      outgoing:[...this.offers.values()].find(offer => offer.from===id),
    };
  }
}
