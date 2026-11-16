export function EquipmentReplacement({equipped,purchased,confirm,cancel}:{
  equipped:string; purchased:string; confirm:()=>void; cancel:()=>void;
}) {
  return <>
    <h2 id="equip-purchase-title">Substituir equipamento?</h2>
    <p id="equip-purchase-item">{equipped} → {purchased}</p>
    <div className="equip-purchase-actions">
      <button type="button" className="hud-button" id="equip-purchase-yes" aria-keyshortcuts="1" onClick={confirm}>
        Sim<kbd className="action-key" aria-hidden="true">1</kbd>
      </button>
      <button type="button" className="hud-button hud-button--secondary" id="equip-purchase-no" aria-keyshortcuts="2" onClick={cancel}>
        Não<kbd className="action-key" aria-hidden="true">2</kbd>
      </button>
    </div>
  </>;
}
