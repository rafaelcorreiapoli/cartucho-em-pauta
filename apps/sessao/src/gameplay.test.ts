import {megaphone} from './equipment';
import {describeFood,pinga} from './food';
import { marketKinds, marketProduct } from './market-catalog';
import { canReachDownedPlayer } from './interactions';
import {expect,test} from 'bun:test';
import {agendaProject,bills,canReachStation,stations,voteIntentSummary} from './plenary';
import {canVerifyDocumentAt,consumableAction,objects,readGameplayAction,treasuryDeliveries} from './gameplay';

test('document verification is offered only at the two document counters',()=>{
  expect(canVerifyDocumentAt('secretary')).toBe(true);
  expect(canVerifyDocumentAt('protocol')).toBe(true);
  expect(canVerifyDocumentAt('archive')).toBe(false);
  expect(canVerifyDocumentAt(undefined)).toBe(false);
  expect(readGameplayAction({kind:'verify-document',item:7,place:'secretary'}))
    .toMatchObject({kind:'verify-document',item:7,place:'secretary'});
});

test('the project panel and history resolve the actual ballot project instead of its sequence number',()=>{
  expect(agendaProject({round:0,project:2}).name).toBe('Teto do Cafezinho');
  expect(agendaProject({round:1,project:0}).name).toBe('Auxílio Churrasco');
  expect(agendaProject({round:bills.length+1}).name).toBe('Wi-Fi na Praça');
});

test('the project HUD labels announced intentions with the player and side',()=>{
  expect(voteIntentSummary([{id:'a',name:'Rafa',vote:'yes'},{id:'b',name:'Bia',vote:'no'}])).toBe('Rafa a favor · Bia contra');
  expect(voteIntentSummary()).toBe('');
});


test('treasury prompts use the carried amount and identity and disappear when redeemed',()=>{
  const cash = {id:7,kind:'briefcase' as const,cash:8};
  const coffee = {id:8,kind:'coffee' as const};
  expect(treasuryDeliveries([cash,coffee])).toEqual([
    {label:'Entregar R$ 80 mil ao tesoureiro',action:{kind:'deliver',place:'treasury',item:7}},
    {label:'Entregar só R$ 40 mil',action:{kind:'deliver',place:'treasury',item:7,target:'partial'}},
  ]);
  expect(treasuryDeliveries([coffee])).toEqual([]);
  expect(treasuryDeliveries([{...cash,cash:.1}])).toHaveLength(1);
});

test('the inventory offers the healing shortcut for the selected kit',()=>{
  expect(objects.firstAidKit.portrait).toBe('retrato-primeiros-socorros.webp');
  const control = consumableAction({id:17,kind:'firstAidKit'});
  expect(control).toEqual({label:'Curar',key:'1',action:{kind:'use',item:17}});
  expect(readGameplayAction(control?.action)).toMatchObject({kind:'use',item:17});
  expect(consumableAction({id:18,kind:'forensicKit'})).toBeUndefined();
});

test('the forensic kit uses its own bundled WebP portrait',async()=>{
  const portrait = objects.forensicKit.portrait;
  expect(portrait).not.toBe(objects.document.portrait);
  const file = Bun.file(new URL('../public/assets/'+portrait,import.meta.url));
  expect(await file.exists()).toBe(true);
  expect(await file.slice(8,12).text()).toBe('WEBP');
});

for (const portrait of new Set(Object.values(objects).map(item=>item.portrait))) {
  test(`the item catalog bundles ${portrait} as WebP`,async()=>{
    expect(portrait).toMatch(/^[a-z0-9-]+\.webp$/);
    const asset = Bun.file(new URL('../public/assets/'+portrait,import.meta.url));
    expect(await asset.exists()).toBe(true);
    expect(await asset.slice(0,4).text()).toBe('RIFF');
    expect(await asset.slice(8,12).text()).toBe('WEBP');
    const header = new DataView(await asset.slice(0,8).arrayBuffer());
    expect(header.getUint32(4,true)+8).toBe(asset.size);
  });
}

// These portraits use the extended WebP header for their transparent canvas.
for (const kind of ['coffee','forensicKit','firstAidKit','baton','wiretap','spyCamera','bugDetector','vip','cabinetLock','lockKit','proLockKit','decoder','masterDecoder'] as const) {
  test(`the ${kind} portrait has a 256 × 256 canvas and alpha`,async()=>{
    const portrait = objects[kind].portrait;
    const asset = Bun.file(new URL('../public/assets/'+portrait,import.meta.url));
    expect(await asset.slice(12,16).text()).toBe('VP8X');
    const header = new DataView(await asset.slice(20,30).arrayBuffer());
    expect(header.getUint8(0) & 0x10).toBe(0x10);
    // WebP stores each canvas dimension minus one in three little-endian bytes.
    expect(header.getUint32(4,true) & 0xffffff).toBe(255);
    expect(header.getUint8(7)+(header.getUint16(8,true)<<8)).toBe(255);
  });
}

test('every item has a distinct inventory portrait',()=>{
  const portraits = Object.values(objects).map(item=>item.portrait);
  expect(new Set(portraits).size).toBe(portraits.length);
});

test('station controls share the reach, wall and hands-free rules',()=>{
  const station = stations.coffee;
  const player = {x:station.x+8,y:station.y};
  expect(canReachStation(player,'coffee')).toBe(true);
  expect(canReachStation({...player,carrying:true},'coffee')).toBe(false);
  expect(canReachStation({...player,barriers:[[station.x+3,station.y-2,2,4]]},'coffee')).toBe(false);
  expect(canReachStation({...player,x:station.x+24},'coffee')).toBe(false);
});

test('item descriptions show the active equipment rules',()=>{
  expect(objects.binoculars.description).toContain('10 s. Recarga automática de 30 s');
  expect(objects.megaphone.description).toContain('15 s');
  expect(objects.xray.description).toContain('10 s');
  expect(objects.vest.description).toContain('35%');
  expect(objects.firstAidKit.description).toContain('35 PV');
});

test('the aid prompt requires a reachable downed teammate and free hands',()=>{
  const actor = {id:'a',x:140,y:146};
  const target = {id:'b',x:152,y:146,knockedOut:true};
  expect(canReachDownedPlayer(actor,target)).toBe(true);
  expect(canReachDownedPlayer(actor,{...target,id:actor.id})).toBe(false);
  expect(canReachDownedPlayer({...actor,carrying:true},target)).toBe(false);
  expect(canReachDownedPlayer(actor,{...target,knockedOut:false})).toBe(false);
  expect(canReachDownedPlayer({...actor,barriers:[[145,140,2,12]]},target)).toBe(false);
});

test('shop listings resolve prices only for products in that shop',()=>{
  expect(marketProduct('food','coffee')).toEqual({kind:'coffee',price:.5});
  expect(marketProduct('equipment','firstAidKit')).toEqual({kind:'firstAidKit',price:1.5});
  expect(marketProduct('equipment','coffee')).toBeUndefined();
  expect(marketKinds.furniture).toEqual(['officeTv','officeRug','officeChair']);
  for (const kind of marketKinds.furniture) expect(marketProduct('equipment',kind)).toBeUndefined();
  expect(marketProduct('furniture','lockpick')).toBeUndefined();
  expect(marketProduct('food','firstAidKit')).toBeUndefined();
  expect(marketProduct('equipment','constructor')).toBeUndefined();
  for (const catalog of ['food','equipment','furniture'] as const) {
    for (const kind of marketKinds[catalog]) {
      expect(objects[kind].portrait).toBeTruthy();
      expect(marketProduct(catalog,kind)?.price).toBeGreaterThan(0);
    }
  }
});

test('lock tool descriptions report the same strength used by the breach rules',()=>{
  const tools = Object.values(objects).filter(item=>'attack' in item);
  expect(tools.map(tool=>tool.attack)).toEqual([1,2,3,4,5]);
  for (const tool of tools) expect(tool.description).toBe(`Arrombamento nível ${tool.attack}.`);
});

test('catalog prices reflect only the applicable public policies',()=>{
  const policies = {coffee:1,furniture:1,equipment:1,mail:1};
  expect(marketProduct('food','coffee',policies)?.price).toBe(.3);
  expect(marketProduct('food','pizza',policies)).toEqual(marketProduct('food','pizza'));
  expect(marketProduct('furniture','officeTv',policies)!.price).toBeLessThan(marketProduct('furniture','officeTv')!.price);
  expect(marketProduct('equipment','binoculars',policies)!.price).toBeLessThan(marketProduct('equipment','binoculars')!.price);
  expect(marketProduct('equipment','forensicKit',policies)!.price).toBeLessThan(marketProduct('equipment','forensicKit')!.price);
  expect(marketProduct('equipment','firstAidKit',policies)).toEqual(marketProduct('equipment','firstAidKit'));
});

test('Pinga has a drink action and enters circulation through the bill, outside the snack shop',()=>{
  expect(consumableAction({id:12,kind:'pinga'})).toMatchObject({label:'Beber',action:{kind:'use',item:12}});
  expect(objects.pinga.portrait).toBe('retrato-pinga.webp');
  const {hp,speed} = pinga.effect;
  expect(objects.pinga.description).toContain(`${hp} PV`);
  expect(objects.pinga.description).toContain(`${speed.durationMs/1000} segundos`);
  expect(describeFood(pinga.effect)).toBe('+15 PV · −20% velocidade por 8 s');
  expect(marketKinds.food).not.toContain('pinga');
  expect(marketProduct('food','pinga')).toBeUndefined();
});

test('the megaphone catalog describes the broadcast limit and the recharge after it ends',()=>{
  expect(objects.megaphone.description).toContain(`até ${megaphone.duration/1000} s`);
  expect(objects.megaphone.description).toContain(`Recarga de ${megaphone.cooldown/1000} s após encerrar`);
});
