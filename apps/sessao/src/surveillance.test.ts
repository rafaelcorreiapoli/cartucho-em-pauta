import {expect,test} from 'bun:test';
import {acceptsSpyCameraFrame,monitoredChannel,type SpyCameraFrame,type SpyView} from './surveillance';

test('the monitoring panel switches between camera and grampo',()=>{
  const view:SpyView = {channels:[
    {id:1,name:'Câmera',room:'Biblioteca',kind:'spyCamera',alerts:true,active:false,removed:false},
    {id:2,name:'Grampo',room:'Cafezinho',kind:'wiretap',alerts:true,active:false,removed:false},
  ],options:[],muted:false};
  expect(monitoredChannel({...view,selected:1})?.kind).toBe('spyCamera');
  expect(monitoredChannel({...view,audio:2})?.kind).toBe('wiretap');
  expect(monitoredChannel(view)).toBeUndefined();
});

test('live surveillance ignores frames for stale, closed and removed channels',()=>{
  const center = {x:245,y:250};
  const frame:SpyCameraFrame = {channel:1,center,people:[],ground:[],decorations:[]};
  const camera = {name:'Câmera',room:'Cafezinho',kind:'spyCamera',alerts:true,active:false,removed:false} as const;
  const view:SpyView = {channels:[{...camera,id:1},{...camera,id:2}],options:[],muted:false};
  expect(acceptsSpyCameraFrame({...view,selected:1},frame)).toBe(true);
  expect(acceptsSpyCameraFrame({...view,selected:2},frame)).toBe(false);
  expect(acceptsSpyCameraFrame({...view,selected:1,channels:[{...camera,id:1,removed:true}]},frame)).toBe(false);
  expect(acceptsSpyCameraFrame(view,frame)).toBe(false);
  expect(acceptsSpyCameraFrame(undefined,frame)).toBe(false);
});
