export const automaticProjectRules = {firstAfter:300_000,interval:90_000,salaryMultiplier:1.25,announcementMs:10_000} as const;
export const automaticProjects = {
  porrete:{name:'Pacote de Diálogo Parlamentar',shortName:'Porrete',description:'O diálogo falhou. O Congresso acaba de ampliar os instrumentos de negociação.',cost:1,effect:'Um porrete para cada parlamentar.',image:'porrete'},
  reajuste:{name:'Reajuste Emergencial de Subsídios',shortName:'Reajuste',description:'Diante da crise, os parlamentares aprovaram um sacrifício: receber mais.',cost:.5,effect:'Salários 25% maiores até o fim da partida, a partir do próximo pagamento.',image:'reajuste'},
  energeticos:{name:'Programa Congresso Sem Dormir',shortName:'Congresso Sem Dormir',description:'Dormir em serviço agora é desperdício de verba. A insônia passa a ser política de Estado.',cost:1,effect:'Cinco energéticos para cada parlamentar.',image:'energeticos'},
  qualificacao:{name:'PEC da Qualificação Parlamentar',shortName:'Qualificação',description:'A qualificação chegou por decreto. Estudar ficou para o contribuinte.',cost:1.5,effect:'Dois pontos de atributo para cada parlamentar distribuir.',image:'qualificacao'},
} as const;
export type AutomaticProject = keyof typeof automaticProjects;
export type AutomaticApproval = {project:AutomaticProject;at:number;cost:number;recipients:number};
export type AutomaticProjectsView = {approved:AutomaticApproval[];total:number;nextIn?:number;announcement?:AutomaticApproval};
