const commands = new WeakMap<HTMLButtonElement,()=>void>();

export function bindContextCommand(activate:()=>void) {
  return (button:HTMLButtonElement|null) => {
    if (!button) return;
    commands.set(button,activate);
    return ()=>{ commands.delete(button); };
  };
}

export function contextCommand(button:HTMLButtonElement) {
  return commands.get(button);
}
