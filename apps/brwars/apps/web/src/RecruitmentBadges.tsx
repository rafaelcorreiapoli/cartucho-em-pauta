import { Clock, UsersThree } from '@phosphor-icons/react';
export function RecruitmentBadges({
  seconds,
  population,
}: {
  seconds: number;
  population: number;
}) {
  return (
    <>
      <em
        className="recruitment-badge recruitment-time"
        aria-label={`Tempo de treinamento: ${seconds} segundos`}
      >
        <Clock />
        {seconds}s
      </em>
      <em
        className="recruitment-badge recruitment-population"
        aria-label={`Ocupa ${population} de população`}
      >
        <UsersThree />
        {population}
      </em>
    </>
  );
}
