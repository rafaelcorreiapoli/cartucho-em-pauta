// Use the regular server with shorter phases for the browser smoke test.
Bun.plugin({
  name:'short-vote-history-rounds',
  setup(build) {
    build.onLoad({filter:/\/sessao\/src\/plenary\.ts$/},async ({path})=>({
      contents:(await Bun.file(path).text()).replace('205_000','12_000').replace('35_000','14000'),
      loader:'ts',
    }));
  },
});
await import('../server/index');

export {};
