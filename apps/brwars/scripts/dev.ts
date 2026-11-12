const children = [
  Bun.spawn(['bun', 'run', '--cwd', 'apps/server', 'dev'], {
    stdout: 'inherit',
    stderr: 'inherit',
  }),
  Bun.spawn(['bun', 'run', '--cwd', 'apps/web', 'dev'], { stdout: 'inherit', stderr: 'inherit' }),
];
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
await Promise.race(children.map((child) => child.exited));
stop();

export {};
