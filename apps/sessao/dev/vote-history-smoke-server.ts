// Short phases and scripted player filings for the browser smoke test.
Bun.plugin({
  name:'short-vote-history-rounds',
  setup(build) {
    build.onLoad({filter:/\/sessao\/src\/plenary\.ts$/},async ({path})=>({
      contents:(await Bun.file(path).text()).replace('debateMs:90_000','debateMs:12_000')
        .replace('cooldownMs:60_000','cooldownMs:3_000').replace('BALLOT_MS = 35_000','BALLOT_MS = 36_000'),
      loader:'ts',
    }));
  },
});
const {defineRoom,defineServer} = await import('colyseus');
const {BunWebSockets} = await import('@colyseus/bun-websockets');
const {SessionRoom} = await import('./classic-room-fixture');
const {ELECTION_RULES} = await import('../src/elections');
const {publishProjectFiling} = await import('../server/project-test-fixture');

class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    this.clock.setInterval(()=>{
      const match:import('../server/PlenaryMatch').PlenaryMatch = Reflect.get(this,'match');
      const players = Reflect.get(this,'players');
      const player:import('../src/map').Player|undefined = players.values().next().value?.player;
      if (!player || match.phase!=='negotiation' || match.projectIndex!==undefined || match.projectRound>=3) return;
      const now = match.gameTime(this.clock.currentTime);
      if (match.gameplayWorld([player],now,()=>false).projectFilingError?.(player.id,match.projectRound)) return;
      if (match.projectRound===0 && players.size>ELECTION_RULES.minimumMandates) {
        const economy:import('../server/PoliticalEconomy').PoliticalEconomy = Reflect.get(match,'economy');
        economy.changePopularity(player.id,-30);
      }
      publishProjectFiling(match,player,match.projectRound,now);
    },500);
  }
}
await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
})
  .listen(Number(process.env.PORT || 2604),'127.0.0.1');

export {};
