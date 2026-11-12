import { HotkeyLabel } from './HotkeyLabel';
import { assignHotkeys, hotkeyAttributes } from './command-hotkeys';
import { ActionCategories } from './hud/ActionCategories';
import { researchGroups } from './research-categories';
import {
  availableResearches,
  MAX_RESEARCH_LEVEL,
  researchBonusText,
  researchBuilding,
  researchCategory,
  RESEARCHES,
  researchLevel,
  researchOrderQuote,
  researchQuote,
  type Command,
  type Player,
  type ResearchKind,
} from '@brwars/simulation';
import type { ReactNode } from 'react';
import { CommandPortrait } from './CommandPortrait';
import { detailAttributes } from './DetailTooltip';
export function ResearchActivity({ player, slot }: { player: Player; slot: number }) {
  const catalog = availableResearches(
    player.buildings.find((item) => item.slot === slot)?.kind === 'school' ? 'school' : 'academy',
  );
  const [rawJob, ...queued] = (player.researchJobs ?? []).filter((item) => item.slot === slot),
    job = rawJob
      ? {
          ...rawJob,
          kind: (['front_mobility', 'ranged_mobility', 'siege_mobility'].includes(
            String(rawJob.kind),
          )
            ? 'mobility'
            : rawJob.kind) as ResearchKind,
        }
      : undefined,
    duration = job?.duration ?? (job ? researchQuote(player, job.kind).duration : 1);
  return (
    <div className="research-activity">
      {job ? (
        <>
          <div
            className="research-current"
            {...detailAttributes({
              title: RESEARCHES[job.kind].name,
              stats: [
                {
                  label: 'Tempo restante',
                  value: `${Math.max(0, Math.ceil(duration - job.progress))}s`,
                  icon: 'clock',
                },
              ],
            })}
          >
            <CommandPortrait kind={job.kind} />
            <div>
              <strong>
                {RESEARCHES[job.kind].name} · N{job.level ?? researchQuote(player, job.kind).level}
              </strong>
              <div
                className="production-progress"
                role="progressbar"
                aria-label={`Pesquisa ${RESEARCHES[job.kind].name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor((job.progress / duration) * 100)}
              >
                <i style={{ width: `${(job.progress / duration) * 100}%` }} />
              </div>
            </div>
          </div>
          {queued.length > 0 && (
            <div className="training-queue research-queue" aria-label="Fila de pesquisas">
              {queued.map((order) => (
                <div
                  key={`${order.kind}-${order.level}`}
                  title={`${RESEARCHES[order.kind].name} · N${order.level}`}
                >
                  <CommandPortrait kind={order.kind} />
                  <small>N{order.level}</small>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <strong>
          {catalog.every((kind) => researchLevel(player, kind) >= MAX_RESEARCH_LEVEL)
            ? 'Todas as pesquisas concluídas'
            : 'Escolha uma pesquisa no painel de ações'}
        </strong>
      )}
    </div>
  );
}
export function ResearchActions({
  player,
  slot,
  playing,
  send,
  extra,
}: {
  player: Player;
  slot: number;
  playing: boolean;
  send: (command: Command) => void;
  extra?: ReactNode;
}) {
  const building =
    player.buildings.find((item) => item.slot === slot)?.kind === 'school' ? 'school' : 'academy';
  const catalog = availableResearches(building);
  return (
    <ActionCategories
      className="research-actions"
      extra={extra}
      categories={researchGroups
        .map((group) => ({ ...group, kinds: group.kinds.filter((kind) => catalog.includes(kind)) }))
        .filter((group) => group.kinds.length > 0)
        .map((group) => ({
          id: group.name,
          label: group.name,
          portrait: <CommandPortrait kind={group.portrait} />,
          actions: group.kinds.map((kind, index) => {
            const spec = RESEARCHES[kind],
              level = researchLevel(player, kind),
              quote = researchOrderQuote(player, kind, slot),
              done = level >= MAX_RESEARCH_LEVEL,
              queuedMax = quote.level > MAX_RESEARCH_LEVEL;
            return (
              <button
                key={kind}
                {...hotkeyAttributes(
                  assignHotkeys(
                    group.kinds.map((kind) => RESEARCHES[kind].name),
                    ['v'],
                  )[index],
                )}
                data-low-cash={player.cash < quote.cost}
                data-resource-shortage={
                  playing && !queuedMax && !quote.blocked && player.cash < quote.cost
                }
                disabled={!playing || queuedMax || quote.blocked || player.cash < quote.cost}
                onClick={() => send({ type: 'research', slot, kind })}
                data-hud-research-title={spec.name}
                data-hud-research-category={`${researchCategory(kind)} · ${researchBuilding(kind) === 'school' ? 'Escola' : 'Universidade'}`}
                data-hud-research-level={level}
                data-hud-research-current={level ? researchBonusText(kind, level) : 'Sem bônus'}
                data-hud-research-next={queuedMax ? '' : researchBonusText(kind, quote.level)}
                data-hud-research-cost={queuedMax ? '' : quote.cost}
                data-hud-research-seconds={queuedMax ? '' : quote.duration}
                data-hud-research-status={
                  done
                    ? 'Nível máximo'
                    : quote.blocked
                      ? 'Pesquisa na fila de outra instituição'
                      : queuedMax
                        ? 'Todos os níveis na fila'
                        : player.cash < quote.cost
                          ? 'R$ insuficientes'
                          : ''
                }
                data-hud-tooltip={`${'category' in spec ? spec.category + ' · ' : ''}${spec.description} Atual ${level}/3.${queuedMax ? '' : ` Próximo: ${researchBonusText(kind, quote.level)}. ${quote.duration}s, R$ ${quote.cost}.`}`}
              >
                <CommandPortrait kind={kind} />
                <em className="research-level-badge" aria-label={`Nível ${level} de 3`}>
                  {level}
                  <small>/3</small>
                </em>
                <div>
                  <strong>
                    <HotkeyLabel
                      label={spec.name}
                      hotkey={
                        assignHotkeys(
                          group.kinds.map((kind) => RESEARCHES[kind].name),
                          ['v'],
                        )[index]
                      }
                    />
                  </strong>
                  <span className="resource-price">
                    {done
                      ? 'NÍVEL MÁXIMO'
                      : quote.blocked
                        ? 'OUTRA FILA'
                        : queuedMax
                          ? 'NA FILA'
                          : `R$ ${quote.cost} · ${quote.duration}s`}
                  </span>
                </div>
              </button>
            );
          }),
        }))}
    />
  );
}
