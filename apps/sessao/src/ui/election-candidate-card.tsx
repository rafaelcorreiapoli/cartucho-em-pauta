import type {ReactNode} from 'react';
import {CharacterPortrait} from './character-portrait';
import {formatElectionPercentage} from '../elections';

export function RankedPortrait({character,rank}:{character:number;rank:number}) {
  return <span className="poll-avatar"><CharacterPortrait character={character}/>
    <span className="poll-rank" data-rank={rank}>{rank}º</span>
  </span>;
}

export function ElectionCandidateCard({character,rank,name,percentage,trend=0,note,lost=false}:{
  character:number; rank:number; name:string; percentage:number; trend?:number; note?:ReactNode; lost?:boolean;
}) {
  const tone = lost || trend<0 ? 'loss' : trend>0 ? 'gain' : 'neutral';
  return <div className="poll-card">
    <RankedPortrait character={character} rank={rank}/>
    <div className="poll-details">
      <div className="poll-label">
        <span data-effect={lost ? 'loss' : undefined}>{name}{note}{lost && <small className="poll-lost">Mandato perdido</small>}</span>
        <strong data-effect={tone}>{formatElectionPercentage(percentage)}%</strong>
        {!!trend && <small data-effect={tone}>{trend>0 ? '+' : ''}{formatElectionPercentage(trend)} pp</small>}
      </div>
      <div className="react-meter" data-tone="budget" role="progressbar" aria-label={'Intenção de voto de '+name}
        aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <span style={{transform:`scaleX(${percentage/100})`}}/>
      </div>
    </div>
  </div>;
}
