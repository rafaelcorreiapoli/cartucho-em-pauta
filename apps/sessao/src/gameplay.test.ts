import {expect,test} from 'bun:test';
import {agendaProject,voteIntentSummary} from './plenary';
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
  expect(agendaProject({round:4}).name).toBe('Wi-Fi na Praça');
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
  ]);
  expect(treasuryDeliveries([coffee])).toEqual([]);
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
for (const kind of ['coffee','forensicKit','firstAidKit','baton','wiretap','spyCamera','bugDetector','vip','cabinetLock'] as const) {
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
