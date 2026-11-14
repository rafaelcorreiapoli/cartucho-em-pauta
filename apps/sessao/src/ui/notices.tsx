import { createRoot } from 'react-dom/client';

type Notice = {id:number; title:string; text:string; critical:boolean; timer:number};

export function mountNotices(host:HTMLElement) {
  const root = createRoot(host);
  let notices:Notice[] = [];
  let sequence = 0;

  function render() {
    root.render(notices.map(({id,title,text,critical})=><div className="hud-module hud-notice" data-critical={critical} key={id}>
      <strong>{title}</strong><span>{text}</span>
    </div>));
  }

  function remove(id:number) {
    const notice = notices.find(entry=>entry.id===id);
    if (!notice) return;
    clearTimeout(notice.timer);
    notices = notices.filter(entry=>entry.id!==id);
    render();
  }

  return {
    notify(title:string,text:string,critical=false) {
      if (notices.length>=2) {
        const replaceable = notices.find(entry=>!entry.critical);
        if (!replaceable && !critical) return;
        remove((replaceable ?? notices[0]).id);
      }
      const id = ++sequence;
      notices.push({id,title,text,critical,timer:window.setTimeout(()=>remove(id),critical ? 7000 : 4500)});
      render();
    },
    destroy() {
      for (const notice of notices) clearTimeout(notice.timer);
      root.unmount();
    },
  };
}
