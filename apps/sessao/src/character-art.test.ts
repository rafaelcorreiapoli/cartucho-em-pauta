import { expect, test } from 'bun:test';
import { attackArt, downedArt, hitArt } from './character-art';
import { NAMES } from './map';

for (const [name,skin] of [
  ['Lula','lula'],
  ['Bolsonaro','bolsonaro'],
  ['Trump','trump'],
  ['Tiririca','tiririca'],
  ['José Sarney','sarney'],
  ['Jean Wyllys','jean-wyllys'],
  ['Sergio Moro','sergio-moro'],
  ['Nestor Cerveró','nestor-cervero'],
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
}
