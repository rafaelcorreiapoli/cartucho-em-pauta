import { HotkeyLabel } from '../HotkeyLabel';
import { assignHotkeys, hotkeyAttributes } from '../command-hotkeys';
import { ArrowBendUpLeft } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface ActionCategory {
  id: string;
  label: string;
  portrait: ReactNode;
  actions: ReactNode;
}

/** Local navigation only; selecting a category never sends a game command. */
export function ActionCategories({
  categories,
  className,
  extra,
}: {
  categories: ActionCategory[];
  className: string;
  extra?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = categories.find((category) => category.id === selected);
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [selected]);
  const keys = assignHotkeys(
    categories.map((category) => category.label),
    ['l', 'd'],
  );
  return (
    <div
      ref={scroller}
      className={`${className} action-categories`}
      role="group"
      aria-label={current ? `Ações · ${current.label}` : 'Categorias de ações'}
    >
      {current ? (
        <>
          <button
            className="command-button economy-command category-tile category-back"
            onClick={() => setSelected(null)}
            data-hud-tooltip="V · Voltar às categorias"
            {...hotkeyAttributes('v')}
            aria-label="Voltar às categorias"
          >
            <div className="command-tile-body">
              <ArrowBendUpLeft weight="bold" />
              <strong>
                <HotkeyLabel label="Voltar" hotkey="v" />
              </strong>
            </div>
            <span>{current.label}</span>
          </button>
          {current.actions}
        </>
      ) : (
        <>
          {categories.map((category, index) => (
            <button
              className="command-button category-tile"
              key={category.id}
              onClick={() => setSelected(category.id)}
              aria-label={`Abrir ${category.label}`}
              data-hud-tooltip={category.label}
              {...hotkeyAttributes(keys[index])}
            >
              {category.portrait}
              <strong>
                <HotkeyLabel label={category.label} hotkey={keys[index]} />
              </strong>
              <span>Explorar</span>
            </button>
          ))}
          {extra}
        </>
      )}
    </div>
  );
}
