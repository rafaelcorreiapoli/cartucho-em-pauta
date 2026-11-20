import {expect,test} from 'bun:test';
import {photoBounds,PHOTO_WIDTH,PHOTO_HEIGHT,PHOTO_LOOK_UP,type PhotoScene} from './photography';

test('surveillance photos retain their complete camera region and phone photos retain their framing',()=>{
  const frame:PhotoScene={center:{x:500,y:300},camera:{x:500,y:281,area:[326,270,266,122]},people:[],ground:[],decorations:[]};
  expect(photoBounds(frame)).toEqual([326,270,266,122]);
  expect(photoBounds({...frame,camera:undefined})).toEqual([500-PHOTO_WIDTH/2,300-PHOTO_HEIGHT/2-PHOTO_LOOK_UP,PHOTO_WIDTH,PHOTO_HEIGHT]);
});
