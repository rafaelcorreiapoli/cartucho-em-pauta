import { expect, test } from 'bun:test';
import { attackArt, downedArt, hitArt, phoneArt, phoneSheets, safeBreachArt, safeBreachSheets, safeDepositArt, safeDepositSheets, npcRobberyArt, npcRobberySheets } from './character-art';
import { NAMES } from './map';

for (const [name,skin] of [
  ['Lula','lula'],
  ['Bolsonaro','bolsonaro'],
  ['Clodovil','clodovil'],
  ['Tiririca','tiririca'],
  ['Sikêra Jr.','sikera-jr'],
  ['Alexandre Frota','alexandre-frota'],
  ['Sergio Moro','sergio-moro'],
  ['Inês Brasil','ines-brasil'],
] as const) {
  const character = NAMES.indexOf(name);

  test(`${name} uses separate attack and hit frames`,()=>{
    expect(attackArt(character,1,.4375,.4375)).toEqual({key:`${skin}-attack`,frame:6});
    expect([0,55,110,165].map(elapsed=>hitArt(character,3,elapsed))).toEqual(
      [4,5,6,7].map(frame=>({key:`${skin}-hit`,frame,flipX:true})),
    );
    expect(hitArt(character,3,220)).toBeUndefined();
  });

  test(`${name} plays the full fall and holds its last frame in the current direction`,()=>{
    expect([0,100,200,300,8000].map(elapsed=>downedArt(character,1,elapsed).frame)).toEqual([4,5,6,7,7]);
    expect(downedArt(character,3,8000)).toMatchObject({key:`${skin}-fall`,frame:7,flipX:true});
    expect(downedArt(character,2)).toMatchObject({key:`${skin}-fall`,frame:11,flipX:false});
  });

  for (const {action,interval,sheets,art} of [
    {action:'phone',interval:135,sheets:phoneSheets,art:phoneArt},
    {action:'safe-breach',interval:200,sheets:safeBreachSheets,art:safeBreachArt},
  ]) {
    test(`${name} uses its own four ${action} frames and honors reduced motion`, async ()=>{
      const key = `${skin}-${action}`;
      const path = `assets/${key}.webp`;
      expect(sheets).toContainEqual({key,path});
      expect([0,1,2,3,4].map(frame=>art(character,frame*interval,false))).toEqual(
        [0,1,2,3,0].map(frame=>({key,frame})),
      );
      expect(art(character,3*interval,true)).toEqual({key,frame:0});
      const asset = Bun.file(new URL(`../public/${path}`,import.meta.url));
      expect(await asset.slice(8,16).text()).toBe('WEBPVP8L');
      const header = new DataView(await asset.slice(21,25).arrayBuffer());
      const dimensions = header.getUint32(0,true);
      expect([1+(dimensions&0x3fff),1+((dimensions>>>14)&0x3fff)]).toEqual([512,128]);
    });
  }
}

test('the replacement skins ship all three combat sheets at the Phaser atlas dimensions', async ()=>{
  for (const skin of ['alexandre-frota','ines-brasil','sikera-jr']) {
    for (const action of ['attack','hit','fall']) {
      const asset = Bun.file(new URL(`../public/assets/${skin}-${action}.webp`,import.meta.url));
      expect(await asset.slice(8,16).text()).toBe('WEBPVP8L');
      const header = new DataView(await asset.slice(21,25).arrayBuffer());
      const dimensions = header.getUint32(0,true);
      expect([1+(dimensions&0x3fff),1+((dimensions>>>14)&0x3fff)]).toEqual([512,384]);
    }
  }
});

test('only Lula has the eight-frame safe deposit animation, with a stationary reduced-motion pose', async ()=>{
  const lula = NAMES.indexOf('Lula');
  expect(Array.from({length:9},(_,frame)=>safeDepositArt(lula,frame*200,false)?.frame)).toEqual([0,1,2,3,4,5,6,7,0]);
  expect(safeDepositArt(lula,1200,true)).toEqual({key:'lula-safe-deposit',frame:3});
  for (let character=0;character<NAMES.length;character++) {
    if (character!==lula) expect(safeDepositArt(character,0,false)).toBeUndefined();
  }
  expect(safeDepositSheets).toEqual([{key:'lula-safe-deposit',path:'assets/lula-safe-deposit.webp'}]);
  const asset = Bun.file(new URL('../public/assets/lula-safe-deposit.webp',import.meta.url));
  expect(await asset.slice(8,16).text()).toBe('WEBPVP8L');
  const header = new DataView(await asset.slice(21,25).arrayBuffer());
  const dimensions = header.getUint32(0,true);
  expect([1+(dimensions&0x3fff),1+((dimensions>>>14)&0x3fff)]).toEqual([1024,128]);
});

test('Lula kneels toward the robbery victim regardless of his previous facing direction',async ()=>{
  const lula = NAMES.indexOf('Lula');
  for (const direction of [0,1,2,3]) {
    const actor = {x:100,y:100,direction};
    for (const y of [90,100,110]) {
      expect(npcRobberyArt(lula,0,false,actor,{x:110,y,direction:1})?.flipX).toBe(false);
      expect(npcRobberyArt(lula,0,false,actor,{x:90,y,direction:1})?.flipX).toBe(true);
    }
  }
  for (const direction of [0,2]) {
    for (const y of [90,110]) {
      const actor = {x:100,y:100,direction};
      expect(npcRobberyArt(lula,0,false,actor,{x:100,y,direction:3})?.flipX).toBe(true);
      expect(npcRobberyArt(lula,0,false,actor,{x:100,y,direction:1})?.flipX).toBe(false);
    }
  }
  const actor = {x:100,y:100,direction:1};
  const target = {x:110,y:100,direction:0};
  expect(Array.from({length:9},(_,frame)=>npcRobberyArt(lula,frame*180,false,actor,target)?.frame)).toEqual([0,1,2,3,4,5,6,7,0]);
  expect(npcRobberyArt(lula,900,true,actor,target)?.frame).toBe(0);
  for (let character=0;character<NAMES.length;character++) {
    if (character!==lula) expect(npcRobberyArt(character,0,false,actor,target)).toBeUndefined();
  }
  expect(npcRobberySheets).toEqual([{key:'lula-npc-robbery',path:'assets/lula-npc-robbery.webp'}]);
  const asset = Bun.file(new URL('../public/assets/lula-npc-robbery.webp',import.meta.url));
  expect(await asset.slice(8,16).text()).toBe('WEBPVP8L');
  const dimensions = new DataView(await asset.slice(21,25).arrayBuffer()).getUint32(0,true);
  expect([1+(dimensions&0x3fff),1+((dimensions>>>14)&0x3fff)]).toEqual([1024,128]);
});
