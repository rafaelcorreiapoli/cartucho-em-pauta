import type {PlenaryView} from '../plenary';
import {ELECTION_RULES} from '../elections';

export function caloteAlertLevel(view:PlenaryView) {
  return view.gameMode==='calote' && view.budget<0 && view.caloteIn!==undefined && view.phase!=='finished'
    ? view.caloteIn<=10 ? 2 : 1 : 0;
}
export function lastInElection(view:PlenaryView,id:string) {
  const polls = view.election?.polls ?? [];
  const own = polls.find(candidate=>candidate.id===id);
  const remaining = view.election?.remaining ?? 0;
  return view.phase!=='finished' && remaining>0 && polls.length>ELECTION_RULES.minimumMandates &&
    !!own && polls.some(candidate=>candidate.estimate>own.estimate) && own.estimate===Math.min(...polls.map(candidate=>candidate.estimate));
}

export function cassationAnnounced(view:PlenaryView,previous:PlenaryView|undefined) {
  if (!previous || view.phase==='lobby' || view.phase==='finished') return false;
  return (!!view.cassationIn && !previous.cassationIn) ||
    (!!view.cassation && !previous.cassation && !previous.cassationIn);
}

export function createCenterAlert() {
  const host = document.createElement('div');
  host.className = 'center-game-alert';
  host.setAttribute('role','alert');
  host.hidden = true;
  document.body.append(host);
  let currentKey:string|undefined;
  let timer:number|undefined;
  let animation:Animation|undefined;
  const queue:{title:string;detail:string;key:string}[] = [];
  const api = {
    show(title:string,detail:string,key='general') {
      host.dataset.key = key;
      currentKey = key;
      window.clearTimeout(timer);
      animation?.cancel();
      const heading = document.createElement('strong');
      const description = document.createElement('span');
      heading.textContent = title;
      description.textContent = detail;
      host.replaceChildren(heading,description);
      host.hidden = false;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation = host.animate([{opacity:1,offset:0},{opacity:1,offset:.75},{opacity:0,offset:1}],{duration:3000,fill:'forwards'});
      }
      timer = window.setTimeout(()=>{
        host.hidden = true;
        const next = queue.shift();
        if (next) api.show(next.title,next.detail,next.key);
      },3000);
    },
    enqueue(title:string,detail:string,key:string) {
      if (host.hidden) api.show(title,detail,key);
      else queue.push({title,detail,key});
    },
    clear(key:string) { if (currentKey===key) { window.clearTimeout(timer); animation?.cancel(); host.hidden = true; currentKey = undefined; const next = queue.shift(); if (next) api.show(next.title,next.detail,next.key); } },
    destroy() { window.clearTimeout(timer); animation?.cancel(); queue.length = 0; host.remove(); },
  };
  return api;
}
