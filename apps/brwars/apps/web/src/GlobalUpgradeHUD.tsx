import { researchGroups } from './research-categories';
import { researchBonusText, RESEARCHES, researchLevel, type Player } from '@brwars/simulation';
import { CommandPortrait } from './CommandPortrait';
export function GlobalUpgradeHUD({ player }: { player: Player }) {
  return (
    <div className="global-upgrade-hud" aria-label="Melhorias globais ativas">
      {researchGroups.map((group) => {
        const active = group.kinds.filter((kind) => researchLevel(player, kind) > 0);
        return (
          active.length > 0 && (
            <section className="upgrade-category" key={group.name} aria-label={group.name}>
              <small>{group.name}</small>
              <div>
                {active.map((kind) => {
                  const level = researchLevel(player, kind);
                  return (
                    <div
                      className="global-upgrade-chip"
                      key={kind}
                      tabIndex={0}
                      aria-label={`${RESEARCHES[kind].name}, nível ${level} de 3: ${researchBonusText(kind, level)}`}
                      data-hud-tooltip={`${RESEARCHES[kind].name} · ${researchBonusText(kind, level)}`}
                    >
                      <CommandPortrait kind={kind} />
                      <span>
                        N{level}
                        <em>/3</em>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        );
      })}
    </div>
  );
}
