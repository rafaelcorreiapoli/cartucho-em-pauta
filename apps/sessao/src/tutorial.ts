import type {GameplayEvent,ObjectKind} from './gameplay';
import {stations} from './plenary';
import {terminals} from './gameplay';
import type {Motion} from './map';

type Step = {highlight?:'stats'|'energy'|'bag'|'equipment'|'agenda'|'profile'|'apps'|'surveillance'|'polls'|'fire'|'power';chapter:string;title:string;text:string;hint:string;target?:Motion;item?:ObjectKind;event?:GameplayEvent['type'];kind?:ObjectKind;manual?:boolean};
export const tutorialSteps:readonly Step[] = [
  {chapter:'Primeiros passos',title:'Conheça seu HUD',highlight:'stats',text:'No alto ficam **vida, energia, experiência e dinheiro**. Passe o mouse ou toque nos indicadores para ler a ajuda.',hint:'Leia os indicadores e use a **seta à direita** para avançar.',manual:true},
  {chapter:'Primeiros passos',title:'Caminhe pelo Congresso',text:'Use o **mouse** para clicar no chão ou ande com **WASD** ou as **setas do teclado**. Segure **Shift** para correr. Vá até o **Cafezinho**.',hint:'A planta do mapa abre com **Tab**.',target:stations.coffee},
  {chapter:'Objetos e equipamentos',title:'Beba um café',text:'No **Cafezinho**, use **Beber café**. Observe sua energia no HUD. Café para levar é vendido na **lanchonete**.',hint:'Aproxime-se do **balcão** para beber.',event:'used',kind:'coffee',target:stations.coffee},
  {chapter:'Objetos e equipamentos',title:'Equipe um acessório',highlight:'bag',text:'Um **binóculo** foi colocado na mochila. Abra a **mochila (O)**, selecione-o e use **Equipar**.',hint:'O equipamento aparece ao lado do seu personagem no **HUD**.',event:'equipped',kind:'binoculars',item:'binoculars'},
  {chapter:'Objetos e equipamentos',title:'Use o equipamento',text:'Use o **binóculo equipado** para ampliar sua visão e observar o mapa.',hint:'Use o **botão do equipamento** ou a tecla **B**.',event:'used',kind:'binoculars'},
  {chapter:'Agenda pessoal',title:'Entenda suas missões',highlight:'agenda',text:'A **Agenda Pessoal** mostra objetivos, progresso e recompensas. Cumprir esses objetivos rende **experiência** e outros prêmios.',hint:'Leia uma **missão** e seus **prêmios** no painel lateral.',manual:true},
  {chapter:'Dinheiro',title:'Faça uma entrega pública',text:'Você recebeu uma **maleta de treino**. Leve-a à **Tesouraria** e **entregue o dinheiro**.',hint:'Abra a planta com **Tab** para localizar a **Tesouraria**.',event:'delivered',kind:'briefcase',item:'briefcase',target:terminals.treasury.point},
  {chapter:'Dinheiro',title:'Guarde dinheiro no gabinete',text:'Você recebeu outra maleta. Leve-a ao **seu gabinete** e use o **cofre** ou guarde-a no **armário**.',hint:'Confira seu gabinete no HUD. No cofre, **Embolsar** transfere o dinheiro para a carteira. No armário, a maleta fica guardada.',event:'stored',kind:'briefcase',item:'briefcase'},
  {chapter:'Dinheiro',title:'Envie um Pix',highlight:'apps',text:'Abra o **celular (C)**, entre em **Pix** e envie um valor a **Bot 1**. O dinheiro sai da carteira.',hint:'Selecione o **destinatário**, escolha o **valor** e confirme.',event:'cash-received'},

  {chapter:'Celular e interação',title:'Ligue para o guia',highlight:'apps',text:'Abra o **celular (C)**, entre em **Telefone** e ligue para **Bot 1**. Ele atenderá.',hint:'O guia aguarda sua **ligação**.',event:'call-time'},
  {chapter:'Celular e interação',title:'Tire uma selfie',highlight:'apps',text:'**Encerre a ligação**. No celular, abra a **câmera** e tire uma **selfie**.',hint:'Use a opção de **câmera frontal**.',event:'photo'},
  {chapter:'Celular e interação',title:'Ofereça um café',text:'O guia se aproxima. Na **mochila (O)**, selecione o **café** e use **Oferecer** para enviá-lo a **Bot 1**.',hint:'Fique **perto do guia** para enviar o pedido. Ele aceitará.',event:'transferred',kind:'coffee',item:'coffee'},
  {chapter:'Documentos e provas',title:'Consiga uma assinatura',text:'Pegue um **documento na Secretaria**, caso ainda não tenha. Na **mochila (O)**, use **Pedir assinatura** e escolha **Bot 1**.',hint:'O guia assina quando você está **perto dele**.',event:'signed',target:stations.secretary},
  {chapter:'Documentos e provas',title:'Publique um comunicado',highlight:'apps',text:'Abra o **Correio Interno** no celular e **publique um comunicado**. Você pode anexar uma foto ou documento.',hint:'Escreva um **assunto** e uma **mensagem** antes de publicar.',event:'mail-published'},
  {chapter:'Popularidade e eleição',title:'Consulte a pesquisa',highlight:'polls',text:'A **popularidade** influencia a disputa eleitoral. Abra a **pesquisa eleitoral** pelo indicador no HUD ou pela tecla **L**.',hint:'Observe quem **lidera** e quem corre **risco de perder o mandato**. **L** também fecha a pesquisa.',manual:true},
  {chapter:'Espionagem',title:'Instale uma câmera',text:'Você recebeu uma **câmera de espionagem**. Entre no **seu gabinete** e **instale-a** usando as ações disponíveis.',hint:'Escolha a câmera na **mochila (O)** para consultar as condições de instalação.',event:'spy-installed',item:'spyCamera'},
  {chapter:'Espionagem',title:'Monitore sua câmera',highlight:'surveillance',text:'Abra **Aplicativos (U)**, escolha **Vigilância** e consulte a **câmera instalada**.',hint:'Vigilância também abre com **V**. Se pulou a instalação, use a **seta à esquerda** para voltar e instalar a câmera.',event:'spy-viewed'},
  {chapter:'Crises',title:'Apague o incêndio',text:'Há um **incêndio de treino**. Você recebeu um **extintor**. Vá ao local e use **Apagar incêndio**.',hint:'Consulte o **aviso de incêndio** para encontrar a sala.',event:'fire-extinguished',item:'extinguisher'},
  {chapter:'Crises',title:'Repare a energia',text:'Vá ao **painel do Apoio Técnico** e opere-o. **Bot 1** cuida do segundo painel.',hint:'Os **dois painéis** precisam ser operados **ao mesmo tempo**.',event:'power-repaired',target:{x:510,y:183}},
];
export type TutorialView = {step:number;complete:boolean;target?:Motion;guide?:string};
export function matchesTutorialEvent(step:Step,event:GameplayEvent) {
  const depositedInSafe = step.event==='stored' && step.kind==='briefcase' && event.type==='money-pocketed';
  return (step.event===event.type || depositedInSafe) && (!step.kind || step.kind===event.kind);
}
