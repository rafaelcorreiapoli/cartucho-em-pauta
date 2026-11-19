import {SessionRoom as GameRoom} from '../server/SessionRoom';

// Existing browser scenarios exercise every optional mechanic in Classic mode.
export class SessionRoom extends GameRoom {
  onCreate(options?:Parameters<GameRoom['onCreate']>[0]) {
    super.onCreate(options);
    Object.assign(this,{gameMode:'classic',lobbyNpcCount:8,phoneGamesEnabled:true,projectVotingEnabled:true,
      electionsEnabled:true,photosEnabled:true,surveillanceEnabled:true,decorationsEnabled:true,portraitsAndVipEnabled:true,automaticProjectsEnabled:false});
  }
}
