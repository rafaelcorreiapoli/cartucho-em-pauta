import {complaintRules,type ComplaintCase,type ComplaintProof,type InfractionKind} from '../src/complaints';
import type {GameplayEvent} from '../src/gameplay';
import type {Motion} from '../src/map';
import type {Photo} from '../src/photography';

type Case = {id:number;kind:Exclude<InfractionKind,'phone-game'>;actor:string;at:number;position:Motion;eligible:Set<string>};

function matchesIncident(photo:Photo,entry:Case) {
  return Math.abs(photo.at-entry.at)<=complaintRules.photoWindowMs && photo.people.some(person=>
    person.id===entry.actor && Math.hypot(person.x-entry.position.x,person.y-entry.position.y)<=complaintRules.photoDistance);
}

export class Complaints {
  private serial = 0;
  private cases = new Map<number,Case>();
  private recent = new Map<string,{id:number;at:number}>();
  private reportedGames = new Set<string>();
  private decisions:ComplaintCase[] = [];

  reset() {
    this.cases.clear();
    this.reportedGames.clear();
    this.recent.clear();
    this.decisions = [];
  }

  record(event:GameplayEvent,started:number) {
    if (event.type!=='hit' && event.type!=='npc-robbed' && event.type!=='safe-robbed') return;
    const eligible = new Set(event.witnesses);
    if (event.target) eligible.add(event.target);
    eligible.delete(event.actor);
    if (!eligible.size) return;
    const key = JSON.stringify([event.type,event.actor,event.target]);
    const previous = this.recent.get(key);
    if (previous && event.at-previous.at<complaintRules.incidentWindowMs) {
      const entry = this.cases.get(previous.id);
      if (entry) for (const witness of eligible) entry.eligible.add(witness);
      return;
    }
    const id = ++this.serial;
    this.recent.set(key,{id,at:event.at});
    this.cases.set(id,{id,kind:event.type,actor:event.actor,at:Math.max(0,event.at-started),position:event.position,eligible});
  }

  available(id:string,name:(id:string)=>string,photos?:readonly Photo[]) {
    return [...this.cases.values()].filter(entry=>entry.eligible.has(id)).map(entry=>({
      ...this.describe(entry,name),
      ...(photos && {photoIds:photos.filter(photo=>matchesIncident(photo,entry)).map(photo=>photo.id)}),
    }));
  }

  private gameKey(photo:Photo,target:string,session?:number) {
    return session===undefined ? `photo:${photo.id}:${target}` : `game:${session}:${target}`;
  }

  private gameProofs(reporter:string,photo:Photo,isPlayer:(id:string)=>boolean) {
    return photo.people.filter(person=>person.id!==reporter && person.phone==='game' && isPlayer(person.id) &&
      !this.reportedGames.has(this.gameKey(photo,person.id,person.gameSession)));
  }

  proofs(reporter:string,photos:readonly Photo[],isPlayer:(id:string)=>boolean,name:(id:string)=>string):ComplaintProof[] {
    const incidentProofs = this.available(reporter,name,photos).flatMap(({kind,photoIds,accused,id})=>kind==='phone-game' ? [] :
      (photoIds ?? []).map(photo=>({photo,kind,accused,id})));
    return [...incidentProofs,...photos.flatMap(photo=>this.gameProofs(reporter,photo,isPlayer).map(person=>({
      photo:photo.id,kind:'phone-game' as const,accused:person.name,target:person.id,
    })))];
  }

  submitGame(reporter:string,photo:Photo,target:string,isPlayer:(id:string)=>boolean,name:(id:string)=>string) {
    const person = this.gameProofs(reporter,photo,isPlayer).find(entry=>entry.id===target);
    if (!person) return;
    this.reportedGames.add(this.gameKey(photo,target,person.gameSession));
    const decision:ComplaintCase = {id:++this.serial,kind:'phone-game',accused:name(target),at:photo.at,hasPhoto:true};
    this.addDecision(decision);
    return {actor:target,decision};
  }

  private addDecision(decision:ComplaintCase) {
    this.decisions = [decision,...this.decisions].slice(0,complaintRules.history);
  }

  history() { return this.decisions; }

  submit(reporter:string,id:number,name:(id:string)=>string,photo?:Photo) {
    const entry = this.cases.get(id);
    if (!entry?.eligible.has(reporter)) return;
    if (photo && !matchesIncident(photo,entry)) return;
    this.cases.delete(id);
    const decision = this.describe(entry,name);
    if (photo) decision.hasPhoto = true;
    this.addDecision(decision);
    return {actor:entry.actor,decision};
  }

  private describe({id,kind,actor,at}:Case,name:(id:string)=>string):ComplaintCase {
    return {id,kind,accused:name(actor),at};
  }
}
