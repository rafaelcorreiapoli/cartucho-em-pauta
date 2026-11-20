import '../../../packages/hud/styles.css';
import '../src/style.css';
import '../src/match-hud.css';
import '../src/rts-hud.css';
import '../src/session-finale.css';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {CassationBallot} from '../src/ui/cassation-ballot';
import {mountResults} from '../src/results';
import type {PlenaryView,Role} from '../src/plenary';

// Browser fixture for measured panel transitions, without a live match clock.
document.body.innerHTML = '<div id="session"><div id="command-deck"><div id="legislative-dock"></div></div></div><dialog id="result-dialog"></dialog><dialog id="session-finale"></dialog><dialog id="cassation-reveal-dialog" aria-labelledby="cassation-reveal-name"></dialog>';
const host = document.querySelector<HTMLElement>('#legislative-dock')!;
const root = createRoot(host);
const results = mountResults(()=>{});
const candidates = Array.from({length:6},(_,index)=>({id:String(index),name:`Parlamentar ${index+1}`,character:index}));
let cycle = 0;
function ballot() {
  const cassation = {calledAt:++cycle,candidates,voted:0,electorate:6,quorum:4,eligible:true,caller:candidates[0],votes:[]};
  flushSync(()=>root.render(<CassationBallot state={cassation} ownId="0" remaining={20} cast={()=>{}}/>));
  return {phase:'negotiation',cassation} as unknown as PlenaryView;
}
let previous = ballot();
Object.assign(window,{
  showBallot() { previous = ballot(); },
  showResult(role:Role|undefined,finished=false) {
    const view = {phase:finished ? 'finished' : 'negotiation',cassationResult:{text:role ? 'O Congresso decidiu cassar o mandato deste parlamentar.' : 'Ninguém foi cassado. Nenhum suspeito recebeu a maioria dos votos.',eliminated:role ? {...candidates[1],role} : undefined},winner:finished ? 'Parlamentar' : undefined} as unknown as PlenaryView;
    results.captureBallot(view,previous);
    flushSync(()=>root.render(null));
    results.render(view,previous);
  },
});
