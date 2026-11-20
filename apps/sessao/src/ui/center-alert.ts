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

export function createCenterAlert() {
  const host = document.createElement('div');
  host.className = 'center-game-alert';
  host.setAttribute('role','alert');
  host.hidden = true;
  document.body.append(host);
  let currentKey:string|undefined;
  let timer:number|undefined;
  let animation:Animation|undefined;
  return {
    show(title:string,detail:string,key='general') {
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
      timer = window.setTimeout(()=>{host.hidden = true;},3000);
    },
    clear(key:string) { if (currentKey===key) { window.clearTimeout(timer); animation?.cancel(); host.hidden = true; currentKey = undefined; } },
    destroy() { window.clearTimeout(timer); animation?.cancel(); host.remove(); },
  };
}
