import { agendas, CABINET_GRANT, CAMPAIGN_COST, HEARING_POPULARITY, PAYMENTS_PER_ROUND, type Agenda, type Contact,
  type Evidence, type Offer, type PoliticsView, type Split } from '../src/politics';
import type { Vote } from '../src/plenary';

type Account = {
  wallet:number; popularity:number; agenda:Agenda; grantUsed:boolean; campaignRound:number; auditRound:number; audits:number; expenses:{kind:string; amount:number; cycle:number}[]; paymentRound:number; payments:number;
  payers:Set<string>; passed:number; rejected:number; exposed:number; known:Set<number>; suspended:boolean;
};
const cap = (value:number) => Math.max(0,Math.min(100,value));

export class PoliticalEconomy {
  private accounts = new Map<string,Account>();
  private contacts = new Map<string,Contact>();
  private records = new Map<number,Evidence>();
  private published = new Set<number>();
  private offers = new Map<number,Offer>();
  private serial = 0;

  reset(contacts:Contact[], random:()=>number) {
    this.contacts = new Map(contacts.map(contact => [contact.id,contact]));
    this.accounts.clear();
    this.records.clear();
    this.published.clear();
    this.offers.clear();
    this.serial = 0;
    const deck = Object.keys(agendas) as Agenda[];
    for (const contact of contacts) {
      const [agenda] = deck.splice(Math.floor(random()*deck.length),1);
      this.accounts.set(contact.id,{wallet:8,popularity:40,agenda,grantUsed:false,campaignRound:-1,auditRound:-1,audits:0,expenses:[],paymentRound:-1,payments:0,
        payers:new Set(),passed:0,rejected:0,exposed:0,known:new Set(),suspended:false});
    }
  }

  popularity(id:string) { return this.accounts.get(id)?.popularity ?? 0; }

  changePopularity(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (account) account.popularity = cap(account.popularity+amount);
  }

  paySalary(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (account) account.wallet += amount;
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
    recipient.wallet += amount;
    recipient.payers.add(from);
    this.record(clandestine ? 'clandestine-transfer' : 'public-transfer',from,amount,round,to);
    return true;
  }

  grant(id:string, diverted:Split, budget:number, round:number) {
    const account = this.accounts.get(id);
    if (!account || account.grantUsed || account.suspended || budget<CABINET_GRANT) return;
    account.grantUsed = true;
    account.wallet += diverted;
    if (diverted>0) this.record('diversion',id,diverted,round);
    return {budget:CABINET_GRANT,stability:(CABINET_GRANT-diverted)*2-diverted};
  }

  campaign(id:string, round:number) {
    const account = this.accounts.get(id);
    if (!account || account.wallet<CAMPAIGN_COST || account.campaignRound===round) return;
    account.wallet -= CAMPAIGN_COST;
    account.campaignRound = round;
    account.popularity = cap(account.popularity+17);
  }

  audit(id:string, round:number, limit=1) {
    const account = this.accounts.get(id);
    if (!account) return;
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
      account.exposed++;
    }
    return record;
  }

  billResult(votes:Map<string,Vote>, passed:boolean, popular:boolean) {
    for (const [id,vote] of votes) {
      const account = this.accounts.get(id);
      if (!account) continue;
      if (passed && vote==='yes') {
        account.passed++;
        account.popularity = cap(account.popularity+(popular ? 8 : -5));
      }
      if (!passed && vote==='no') account.rejected++;
    }
  }

  suspend(id:string) {
    const account = this.accounts.get(id);
    if (account) {
      account.suspended = true;
      account.popularity = cap(account.popularity-20);
    }
  }

  view(id:string, contacts:Contact[], round:number, canCallHearing:boolean, eligible:(id:string) => boolean): PoliticsView | undefined {
    const account = this.accounts.get(id);
    if (!account) return;
    const {wallet,popularity,agenda,grantUsed,suspended} = account;
    const goalMet = {
      fortuna:wallet>=12, campanha:popularity>=65, articulacao:account.payers.size>=2,
      projetos:account.passed>=2, oposicao:account.rejected>=2, escandalo:account.exposed>0,
    }[agenda];
    return {
      wallet,popularity,agenda,goalMet,grantUsed,suspended,campaigned:account.campaignRound===round,
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
