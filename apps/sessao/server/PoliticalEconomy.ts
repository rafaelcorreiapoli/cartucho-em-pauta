import {investmentRules} from '../src/public-investments';
import type {AgendaDecoration} from '../src/installations';
import type { OfficeFurniture } from '../src/private-offices';
import { CharacterProgression } from './CharacterProgression';
import { attributeUpgrades, type AttributeRequest } from '../src/progression';
import type { GameplayEvent, ObjectKind } from '../src/gameplay';
import {decorationPopularity} from '../src/gameplay';
import { canTransferAmount, money, HEARING_POPULARITY, PAYMENTS_PER_ROUND, type Contact, type DirectoryContact,
  type Agenda, type Evidence, type EvidenceKind, type Offer, type PoliticsView } from '../src/politics';
import type { BillVote, Vote } from '../src/plenary';
import { PersonalAgenda, type AgendaAction, type AgendaMetrics } from './PersonalAgenda';

type TransferChannel = 'transfer'|'pix';
type TransferCompleted = Readonly<{id:number;from:string;to:string;amount:number;channel:TransferChannel}>;

type Account = AgendaMetrics & {
  wallet:number; walletIncome:number; popularity:number; agenda:PersonalAgenda; progression:CharacterProgression;
  grantReadyAt:number; auditRound:number; audits:number; paymentRound:number; payments:number;
  selfieBonus:boolean; known:Set<number>; suspendedUntil?:number;
};
const cap = (value:number) => Math.max(0,Math.min(100,value));

export class PoliticalEconomy {
  private accounts = new Map<string,Account>();
  private contacts = new Map<string,DirectoryContact>();
  private records = new Map<number,Evidence>();
  private published = new Set<number>();
  private offers = new Map<number,Offer>();
  private serial = 0;
  private matchId = 0;
  private agendaRound = 0;
  private rewardReserve = 0;
  private transferred = 0;
  private reserveFees = 0;
  private npcIds = new Set<string>();
  private readonly creditedDecorations = new Set<number>();
  private officialScandal = false;
  private scandalPizzas = new Set<number>();

  reset(contacts:DirectoryContact[], random:()=>number,
    canAgendaAction?:(id:string,kind:AgendaAction)=>boolean,botIds:ReadonlySet<string> = new Set()) {
    this.matchId++;
    this.agendaRound = 0;
    this.transferred = this.reserveFees = 0;
    this.npcIds.clear();
    this.rewardReserve = contacts.length*8;
    this.contacts = new Map(contacts.map(contact => [contact.id,contact]));
    this.accounts.clear();
    this.records.clear();
    this.published.clear();
    this.offers.clear();
    this.serial = 0;
    this.scandalPizzas.clear();
    this.officialScandal = false;
    this.creditedDecorations.clear();
    for (const contact of contacts) {
      const metrics = {wallet:8,popularity:40,hasScandal:()=>this.hasPublicScandal(),
        canExposeScandal:()=>this.hasUnpublishedScandal(contact.id),
        isScandalPizza:(id:number)=>this.scandalPizzas.has(id),
        npcHasCash:(minimum=0.1)=>[...this.npcIds].some(id=>this.wallet(id)>=minimum),
        canPay:()=>!this.suspended(contact.id) && this.paymentsLeft(contact.id,this.agendaRound)>0,
        canAgendaAction:canAgendaAction && ((kind:AgendaAction)=>canAgendaAction(contact.id,kind))};
      const progression = new CharacterProgression(this.matchId);
      const agenda = new PersonalAgenda(metrics,contacts.length,random,(reward,completed)=>{
        const account = this.accounts.get(contact.id);
        if (!account) return;
        const after = this.earnXp(contact.id,reward.xp)!;
        console.info(JSON.stringify({event:'mission-xp',playerId:contact.id,matchId:after.matchId,
          missions:completed.map(({id,kind})=>({id,kind})),amount:reward.xp,xp:after.xp}));
        const cash = Math.min(this.rewardReserve,reward.cash ?? 0);
        this.rewardReserve -= cash;
        this.credit(account,cash);
        if (reward.popularity) account.popularity = cap(account.popularity+reward.popularity);
      },botIds);
      this.accounts.set(contact.id,{
        ...metrics,walletIncome:0,agenda,progression,selfieBonus:false,
        grantReadyAt:0,auditRound:-1,audits:0,paymentRound:-1,payments:0,
        known:new Set(),
      });
    }
  }

  allocate(id:string, request:AttributeRequest) {
    const progression = this.accounts.get(id)?.progression;
    if (!progression?.allocate(request)) return false;
    const {attribute,matchId} = request;
    console.info(JSON.stringify({event:'attribute-allocated',playerId:id,matchId,attribute,
      increment:attributeUpgrades[attribute].bonus,pointsInvested:progression.view().invested[attribute]}));
    return true;
  }

  addParliamentarian(contact:DirectoryContact, wallet:number) {
    const sample = this.accounts.values().next().value;
    if (!sample) return;
    this.npcIds.add(contact.id);
    const {agenda,progression,canPay:_canPay,canAgendaAction:_canAgendaAction,canExposeScandal:_canExposeScandal,...initial} = sample;
    this.contacts.set(contact.id,contact);
    this.accounts.set(contact.id,{...initial,wallet,walletIncome:0,known:new Set(),agenda:new PersonalAgenda({wallet,popularity:40},1,Math.random,()=>{}),
      progression:new CharacterProgression(this.matchId)});
    console.info(JSON.stringify({event:'money-issued',source:'npc-start',id:contact.id,amount:wallet}));
  }

  totals() {
    let humans = 0, npcs = 0;
    for (const [id,account] of this.accounts) {
      if (this.npcIds.has(id)) npcs += account.wallet;
      else humans += account.wallet;
    }
    return {humans,npcs,reserve:this.rewardReserve,transferred:this.transferred,reserveFees:this.reserveFees};
  }

  takeWallet(id:string,fraction=1) {
    const account = this.accounts.get(id);
    if (!account) return 0;
    const amount = Math.floor(Math.round(account.wallet*10)*fraction)/10;
    account.wallet = Math.round((account.wallet-amount)*10)/10;
    return amount;
  }

  wallet(id:string) { return this.accounts.get(id)?.wallet ?? 0; }

  hasEvidence(id:string,kind:EvidenceKind) {
    const known = this.accounts.get(id)?.known;
    return [...(known ?? []),...this.published].some(key=>this.records.get(key)?.kind===kind);
  }

  missionSwapUsed(id:string) {
    return this.accounts.get(id)?.agenda.missionSwapUsed ?? false;
  }

  swapMissions(id:string) {
    const account = this.accounts.get(id);
    return account ? account.agenda.swapMissions(account) : 'unavailable';
  }

  hasMission(id:string,mission:Agenda) {
    return this.accounts.get(id)?.agenda.hasActive(mission) ?? false;
  }

  popularity(id:string) { return this.accounts.get(id)?.popularity ?? 0; }

  changePopularity(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (!account) return;
    account.popularity = cap(account.popularity+amount);
    account.agenda.progress(account);
  }

  private credit(account:Account, amount:number) {
    account.wallet = Math.round((account.wallet+amount)*10)/10;
    account.walletIncome = Math.round((account.walletIncome+amount)*10)/10;
  }

  rewardFromReserve(id:string,amount:number) {
    if (!this.accounts.has(id) || !Number.isSafeInteger(amount*10) || amount<=0) return;
    const paid = Math.min(amount,this.rewardReserve);
    this.rewardReserve = Math.round((this.rewardReserve-paid)*10)/10;
    this.earn(id,paid);
  }

  earn(id:string, amount:number) {
    const account = this.accounts.get(id);
    if (!account) return;
    this.credit(account,amount);
    account.agenda.progress(account);
  }

  spend(id:string,amount:number) {
    const account = this.accounts.get(id);
    if (!account || !Number.isSafeInteger(amount*10) || amount<=0 || amount>account.wallet) return false;
    account.wallet = Math.round((account.wallet-amount)*10)/10;
    this.rewardReserve = Math.round((this.rewardReserve+amount)*10)/10;
    this.reserveFees = Math.round((this.reserveFees+amount)*10)/10;
    return true;
  }

  earnXp(id:string,amount:number) {
    const progression = this.accounts.get(id)?.progression;
    if (!progression) return;
    const before = progression.view();
    progression.earn(amount);
    const after = progression.view();
    if (after.level>before.level) console.info(JSON.stringify({event:'level-up',playerId:id,
      matchId:after.matchId,from:before.level,to:after.level,points:after.level-before.level}));
    return after;
  }

  settleBet(id:string,stake:number,payout:number,maxPayout:number) {
    const stakeThousands = Math.round(stake*10);
    const reserveThousands = Math.round(this.rewardReserve*10);
    if (Math.round(this.wallet(id)*10)<stakeThousands ||
        reserveThousands+stakeThousands<Math.round(maxPayout*10)) return false;
    if (!payout) return this.spend(id,stake);
    this.rewardFromReserve(id,(Math.round(payout*10)-stakeThousands)/10);
    return true;
  }

  name(id:string) { return this.contacts.get(id)?.name ?? 'Jogador'; }
  suspended(id:string) { return this.accounts.get(id)?.suspendedUntil!==undefined; }
  canCall(id:string) { return (this.accounts.get(id)?.popularity ?? 0)>=HEARING_POPULARITY && !this.suspended(id); }
  cancelOffers(id?:string) {
    for (const [key,offer] of this.offers) if (!id || offer.from===id || offer.to===id) this.offers.delete(key);
  }

  private record(kind:Evidence['kind'], from:string, amount:number, round:number, to?:string) {
    const id = ++this.serial;
    const evidence:Evidence = {id,kind,from,to,amount,round};
    this.records.set(id,evidence);
    this.accounts.get(from)?.known.add(id);
    if (to) this.accounts.get(to)?.known.add(id);
    if (kind==='public-transfer') this.published.add(id);
    return evidence;
  }

  transfer(from:string, to:string, amount:number, clandestine:boolean, round:number, channel:TransferChannel='transfer') {
    const source = this.accounts.get(from), recipient = this.accounts.get(to);
    if (!source || !recipient || from===to || !canTransferAmount(amount,source.wallet)) return false;
    if (source.paymentRound!==round) {
      source.paymentRound = round;
      source.payments = 0;
    }
    if (source.payments>=PAYMENTS_PER_ROUND) return false;
    source.payments++;
    this.transferred += amount;
    source.wallet -= amount;
    this.credit(recipient,amount);
    const evidence = this.record((channel==='pix' || clandestine) ? 'clandestine-transfer' : 'public-transfer',from,amount,round,to);
    this.recordTransferCompleted({id:evidence.id,from,to,amount,channel});
    return true;
  }

  private recordTransferCompleted(event:TransferCompleted) {
    const {from,to,amount,channel} = event;
    const recipient = this.accounts.get(to);
    const source = this.accounts.get(from);
    if (!source || !recipient || this.npcIds.has(from) || this.npcIds.has(to)) return;
    recipient.agenda.recordPayment(recipient,from,event.id,channel==='pix');
    source.agenda.recordTransfer(source,amount,to,event.id,channel==='pix');
  }

  grant(id:string,diverted:number,round:number,now:number) {
    const account = this.accounts.get(id);
    if (!account || now<account.grantReadyAt || this.suspended(id)) return false;
    account.grantReadyAt = now+investmentRules.cooldownMs;
    this.credit(account,diverted);
    account.agenda.progress(account);
    if (diverted>0) this.record('diversion',id,diverted,round);
    return true;
  }

  audit(id:string, round:number, limit=1, bankFee=0) {
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
    const charge = candidate.kind==='clandestine-transfer' ? bankFee : 0;
    if (charge>0 && !this.spend(id,charge)) {
      return `A consulta bancária custa ${money(bankFee)}. Saldo insuficiente.`;
    }
    this.deliverEvidence(id,candidate.id);
    account.audits++;
    return charge>0 ? `Documento encontrado. Taxa da consulta bancária: ${money(charge)}.`
      : 'Documento encontrado. Confira seu dossiê.';
  }

  share(from:string, to:string, evidence:number, price:number) {
    const seller = this.accounts.get(from), recipient = this.accounts.get(to);
    if (!seller?.known.has(evidence) || !recipient || recipient.known.has(evidence) ||
      this.published.has(evidence) || !Number.isSafeInteger(price) || price<0) return;
    if (price===0) {
      this.deliverEvidence(to,evidence);
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
    this.deliverEvidence(buyer,offer.evidence);
  }

  private deliverEvidence(recipient:string, evidence:number) {
    const account = this.accounts.get(recipient);
    if (account) {
      account.known.add(evidence);
      account.agenda.progress(account);
    }
    for (const [id,offer] of this.offers) {
      if (offer.to===recipient && offer.evidence===evidence) this.offers.delete(id);
    }
  }

  cancel(by:string, id:number) {
    const offer = this.offers.get(id);
    if (offer && (offer.from===by || offer.to===by)) this.offers.delete(id);
  }

  private countsAsScandal(id:string, record:Evidence) {
    return record.kind!=='public-transfer' && record.from!==id && record.to!==id;
  }

  private hasUnpublishedScandal(id:string) {
    return [...(this.accounts.get(id)?.known ?? [])].some(key=>{
      const record = this.records.get(key);
      return !!record && !this.published.has(key) && this.countsAsScandal(id,record);
    });
  }

  publish(id:string, evidence:number) {
    const account = this.accounts.get(id), record = this.records.get(evidence);
    if (!account?.known.has(evidence) || !record || this.published.has(evidence)) return;
    this.published.add(evidence);
    for (const [key,offer] of this.offers) if (offer.evidence===evidence) this.offers.delete(key);
    const subject = this.accounts.get(record.from);
    if (subject) subject.popularity = cap(subject.popularity-(record.kind==='diversion' ? 6+record.amount*4 : 8));
    if (record.to) {
      const receiver = this.accounts.get(record.to);
      if (receiver) receiver.popularity = cap(receiver.popularity-5);
    }
    if (id!==record.from && id!==record.to) {
      account.popularity = cap(account.popularity+10);
      if (this.countsAsScandal(id,record)) account.agenda.progress(account,{escandalo:1});
    }
    for (const other of this.accounts.values()) {
      if (other.known.has(evidence)) other.agenda.replaceUnavailableScandal(other);
    }
    return record;
  }

  recordVote(id:string, first:boolean, firstSupport:boolean) {
    const account = this.accounts.get(id);
    if (account) account.agenda.recordVote(account,first,firstSupport);
  }

  billResult(votes:Map<string,BillVote>, passed:boolean, popular:boolean) {
    for (const [id,vote] of votes) {
      const account = this.accounts.get(id);
      if (!account) continue;
      if (passed && vote==='yes') {
        account.popularity = cap(account.popularity+(popular ? 8 : -5));
      }
      account.agenda.progress(account,{
        projetos:Number(passed && vote==='yes'),oposicao:Number(!passed && vote==='no'),
      });
    }
  }

  expireSuspensions(now:number) {
    let changed = false;
    for (const account of this.accounts.values()) {
      if (account.suspendedUntil===undefined || account.suspendedUntil>now) continue;
      account.suspendedUntil = undefined;
      changed = true;
    }
    return changed;
  }

  suspensionEndsAt(id:string) { return this.accounts.get(id)?.suspendedUntil; }

  suspensionRemaining(id:string,now:number) {
    return Math.max(0,Math.ceil(((this.suspensionEndsAt(id) ?? now)-now)/1000));
  }

  suspend(id:string,until:number) {
    const account = this.accounts.get(id);
    if (account) {
      account.suspendedUntil = until;
      account.popularity = cap(account.popularity-20);
    }
  }

  recordOfficialScandal() { this.officialScandal = true; }

  private hasPublicScandal() {
    return this.officialScandal || [...this.published].some(key=>this.records.get(key)?.kind!=='public-transfer');
  }

  recordGameplay(event:GameplayEvent) {
    const account = this.accounts.get(event.actor);
    if (!account || !account.agenda.acceptGameplayEvent(event)) return;
    if (event.type==='installed' && event.item!==undefined && (event.kind==='portrait' || event.kind==='vip') &&
        !this.creditedDecorations.has(event.item)) {
      this.creditedDecorations.add(event.item);
      this.changePopularity(event.actor,decorationPopularity[event.kind]);
    }
    if (event.kind==='pizza' && event.item!==undefined) {
      if (event.type==='installed' && this.hasPublicScandal()) {
        this.scandalPizzas.add(event.item);
      }
      if (event.type==='uninstalled') this.scandalPizzas.delete(event.item);
    }
    if ((event.type==='photo-published' || event.type==='mail-published') && event.photo?.selfie && event.photo.author.id===event.actor &&
      event.photo.people.some(person=>person.id!==event.actor) && !account.selfieBonus) {
      account.selfieBonus = true;
      account.popularity = cap(account.popularity+4);
    }
    account.agenda.applyGameplayEvent(account,event,this.scandalPizzas.has(event.item ?? -1));
    if (event.type==='signed' && event.target && event.target!==event.actor && event.item!==undefined) {
      const owner = this.accounts.get(event.target);
      owner?.agenda.recordSignature(owner,event.item,event.actor);
    }
  }

  setAgendaCashAvailability(canPartiallyDepositCash:(itemId:number)=>boolean) {
    for (const account of this.accounts.values()) Object.assign(account,{canPartiallyDepositCash});
  }

  setAgendaMailAvailability(canPublishMail:(id:string)=>boolean,agendaSelfies?:(id:string)=>ReturnType<NonNullable<AgendaMetrics['agendaSelfies']>>,agendaReportNotices?:(id:string)=>readonly number[]) {
    for (const [id,account] of this.accounts) Object.assign(account,{
      canPublishMail:()=>canPublishMail(id),
      agendaSelfies:agendaSelfies && (()=>agendaSelfies(id)),
      agendaReportNotices:agendaReportNotices && (()=>agendaReportNotices(id)),
    });
  }

  setAgendaCrisisAvailability(canRepairOutage:(id:string)=>boolean,canFightCrisis:(id:string)=>boolean) {
    for (const [id,account] of this.accounts) Object.assign(account,{
      canRepairOutage:()=>canRepairOutage(id),canFightCrisis:()=>canFightCrisis(id),
    });
  }

  setAgendaCommerce(commerce:NonNullable<AgendaMetrics['commerce']>) {
    for (const account of this.accounts.values()) Object.assign(account,{commerce});
  }

  setAgendaXrayAvailability(canUse:(id:string,wallet:number)=>boolean) {
    for (const [id,account] of this.accounts) Object.assign(account,{canUseXray:()=>canUse(id,account.wallet)});
  }

  setAgendaInventory(owns:(id:string,kind:ObjectKind)=>boolean,officeStock?:(id:string)=>readonly OfficeFurniture[],
    hasAgendaDecoration?:(id:string,kind:AgendaDecoration,replacement?:boolean)=>boolean,
    npcVotePrice?:(id:string)=>number|undefined,hasOffice?:(id:string)=>boolean,installedPizza?:(id:string)=>ReturnType<NonNullable<AgendaMetrics['installedPizza']>>, npcSignaturePrices?:(id:string)=>number[], hasLuxuryDecoration?:()=>boolean, canInstallSpy?:(id:string,kind:'wiretap'|'spyCamera')=>boolean, agendaCameras?:(id:string,credited:ReadonlySet<string>)=>ReturnType<NonNullable<AgendaMetrics['agendaCameras']>>, ownsWiretap?:(id:string)=>boolean, hasCashLot?:(id:string,amount:number)=>boolean, hasKnownForeignSpy?:(id:string)=>boolean) {
    for (const [id,account] of this.accounts) {
      const canAffordNpcSignatures = npcSignaturePrices && ((needed:number)=>{
        const prices = npcSignaturePrices(id).sort((a,b)=>a-b).slice(0,needed);
        const total = prices.reduce((sum,price)=>sum+price,0);
        return prices.length===needed && total<=account.wallet &&
          prices.filter(price=>price>0).length<=this.paymentsLeft(id,this.agendaRound);
      });
      Object.assign(account,{hasKnownForeignSpy:hasKnownForeignSpy && (()=>hasKnownForeignSpy(id)),hasCashLot:hasCashLot && ((amount:number)=>hasCashLot(id,amount)),ownsWiretap:ownsWiretap && (()=>ownsWiretap(id)),hasLuxuryDecoration,agendaCameras:agendaCameras && ((credited:ReadonlySet<string>)=>agendaCameras(id,credited)),canInstallSpy:canInstallSpy && ((kind:'wiretap'|'spyCamera')=>canInstallSpy(id,kind)),canAffordNpcSignatures,installedPizza:installedPizza && (()=>installedPizza(id)),hasOffice:hasOffice && ((target=id)=>hasOffice(target)),npcVotePrice:npcVotePrice && (()=>npcVotePrice(id)),owns:(kind:ObjectKind)=>owns(id,kind),officeStock:officeStock && (()=>officeStock(id)),
        hasAgendaDecoration:hasAgendaDecoration && ((kind:AgendaDecoration,replacement?:boolean)=>hasAgendaDecoration(id,kind,replacement))});
    }
  }

  interruptPlenaryVisits() {
    for (const account of this.accounts.values()) account.agenda.interruptPlenaryVisit();
  }

  updateAgendaEligibility(players:ReadonlySet<string>, ballotsLeft:number,hasMandate:(id:string)=>boolean = ()=>true,round=0,disconnected:ReadonlySet<string> = new Set(),hasFutureAdvertising?:(id:string)=>boolean) {
    if (this.agendaRound!==round) for (const account of this.accounts.values()) account.agenda.resetBallot();
    this.agendaRound = round;
    const availableTargets = new Set([...players].filter(id=>!this.suspended(id) && !disconnected.has(id)));
    const eligiblePayers = () => [...availableTargets].filter(id=>
      !this.npcIds.has(id) && canTransferAmount(1,this.wallet(id)) && this.paymentsLeft(id,round)>0);
    for (const id of players) {
      if (disconnected.has(id)) continue;
      const account = this.accounts.get(id);
      const targets = [...players].filter(other=>other!==id && !this.npcIds.has(other))
        .map(other=>({id:other,name:this.name(other)}));
      if (!account) continue;
      Object.assign(account,{
        hasFutureAdvertising:hasFutureAdvertising && (()=>hasFutureAdvertising(id)),
        canReceivePayments:(required:number)=>availableTargets.has(id) &&
          eligiblePayers().filter(payer=>payer!==id).length>=required,
      });
      account.agenda.updateEligibility(account,players.size,hasMandate(id) && !this.suspended(id),
        ballotsLeft,this.npcIds.size,targets,availableTargets,this.npcIds);
    }
  }

  paymentsLeft(id:string,round:number) {
    const account = this.accounts.get(id);
    return PAYMENTS_PER_ROUND-(account?.paymentRound===round ? account.payments : 0);
  }

  view(id:string, contacts:Contact[], round:number, canCallHearing:boolean, eligible:(id:string) => boolean, pixAvailable?:(id:string)=>boolean,now=0): PoliticsView | undefined {
    const account = this.accounts.get(id);
    if (!account) return;
    const {wallet,walletIncome,popularity,grantReadyAt} = account;
    return {
      wallet,walletIncome,popularity,grantCooldown:Math.max(0,Math.ceil((grantReadyAt-now)/1000)),suspended:this.suspended(id),
      missions:account.agenda.view(account),
      progression:account.progression.view(),
      canCallHearing:canCallHearing && this.canCall(id),contacts,
      paymentsLeft:this.paymentsLeft(id,round),
      directory:[...this.contacts.values()].filter(contact=>!this.npcIds.has(contact.id)).map(contact => ({
        ...contact,popularity:this.accounts.get(contact.id)!.popularity,eligible:eligible(contact.id),pixAvailable:pixAvailable?.(contact.id),
      })),
      evidence:[...account.known].filter(key => !this.published.has(key)).map(key => this.records.get(key)!),
      ledger:[...this.published].map(key => this.records.get(key)!),
      incoming:[...this.offers.values()].filter(offer => offer.to===id),
      outgoing:[...this.offers.values()].find(offer => offer.from===id),
    };
  }
}
