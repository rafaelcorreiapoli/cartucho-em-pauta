import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConnectionLatency,observeLatency} from './connection-latency';

test('latency drops stale replies and resumes only with a new measurement',()=>{
  const replies:((ms:number)=>void)[] = [];
  const displayed:(number|undefined)[] = [];
  const tracker = observeLatency(reply=>replies.push(reply),value=>displayed.push(value));
  tracker.sample();
  replies[0](15.8);
  tracker.sample();
  replies[1](16.1);
  tracker.sample();
  tracker.pause();
  tracker.sample();
  expect(replies).toHaveLength(3);
  replies[2](55);
  tracker.resume();
  replies[3](10.4);
  expect(displayed).toEqual([16,undefined,10]);
  expect(renderToStaticMarkup(<ConnectionLatency milliseconds={10}/>)).toContain('10 ms');
  expect(renderToStaticMarkup(<ConnectionLatency/>)).toBe('');
});
