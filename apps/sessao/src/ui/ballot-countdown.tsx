import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';

export function BallotCountdownMessage({seconds}:{seconds:number}) {
  return <p id="ballot-countdown-message" role="status">Votação começando em {seconds}…</p>;
}

export function mountBallotCountdown(dialog:HTMLDialogElement) {
  const root = createRoot(dialog);
  let shownSeconds:number|undefined;
  dialog.addEventListener('cancel',event=>event.preventDefault());

  return {
    get open() { return dialog.open; },
    update(seconds?:number) {
      if (seconds===undefined) {
        dialog.close();
        return;
      }
      if (seconds!==shownSeconds) {
        flushSync(()=>root.render(<BallotCountdownMessage seconds={seconds}/>));
        shownSeconds = seconds;
      }
      if (!dialog.open) dialog.showModal();
    },
  };
}
