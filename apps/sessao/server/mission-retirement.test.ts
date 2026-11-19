import {expect,test} from 'bun:test';
import {PersonalAgenda} from './PersonalAgenda';
import type {Agenda,Mission} from '../src/politics';

const removed = new Set<Agenda>([
  'bombom','cafeEstrategico','fiscalCafe','bandejaGourmet',
  'visitaAlvo','visitaCortesia','visitaArquivo','visitaGabinete','passeio',
  'presencaPlenario','reuniaoGabinete','reuniaoPublica','visitaDoisGabinetes',
  'primeirosSocorros','debateTelefonico','chamadasUrgentes',
]);
const preserved:Agenda[] = ['cafe','nocauteDuplo','porretadaGabinete','nocauteGabinete','nocautePlenario','equipamento','discursoMegafone'];
const metrics = {wallet:100,popularity:40};
const contacts = ['b','c','d','e','f'].map(id=>({id,name:id}));

function availableKinds(agenda:PersonalAgenda) {
  return new Set<Agenda>([...Reflect.get(agenda,'missionDeck'),...agenda.view(metrics).active.map(({kind})=>kind)]);
}

function expectNoRetired(missions:readonly Mission[]) {
  expect(missions.some(({kind})=>removed.has(kind))).toBe(false);
}

test.each([true,false])('retired missions never enter the initial agenda, pool or Silvio replacement, features=%s',enabled=>{
  for (let seed=0;seed<100;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),enabled,enabled,enabled,enabled,enabled,enabled,enabled);
    expectNoRetired(agenda.view(metrics).active);
    for (const kind of availableKinds(agenda)) expect(removed.has(kind)).toBe(false);
    for (const kind of preserved) expect(availableKinds(agenda).has(kind)).toBe(true);
    agenda.updateEligibility(metrics,6,true,3,0,contacts);
    expectNoRetired(agenda.view(metrics).active);
    expect(agenda.swapMissions(metrics)).toBe('swapped');
    expectNoRetired(agenda.view(metrics).active);
    for (const kind of availableKinds(agenda)) expect(removed.has(kind)).toBe(false);
    if (!enabled) expect(availableKinds(agenda).size).toBe(53);
  }
});
