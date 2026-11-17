import { mapDoor, mapPoint, roomBounds } from './congress-layout';
import type { Office } from './elections';
import type { ObjectKind } from './gameplay';
import type { Agenda, EvidenceKind } from './politics';

export const snackBar = {
  name:'Lanchonete', bounds:roomBounds('Lanchonete'), door:mapDoor('Lanchonete'),
} as const;

export const npcs = {
  vendor:{name:'Daniel Vorcaro',sprite:'daniel-vorcaro.webp',portrait:'retrato-daniel-vorcaro.webp',x:675,y:231,direction:0,dialogue:'convenience',label:'Apoio Técnico',catalog:'equipment'},
  furnitureVendor:{name:'Roberto Justus',sprite:'roberto-justus.webp',portrait:'retrato-roberto-justus.webp',x:525,y:451,direction:0,
    interaction:{x:530,y:466},dialogue:'furniture',label:'Gabinete de Luxo',catalog:'furniture'},
  credentialsVendor:{name:'Carmem Carimbo',sprite:'carmem-carimbo.webp',portrait:'retrato-carmem-carimbo.webp',x:160,y:473,direction:0,
    interaction:{x:149,y:493},dialogue:'credentials',label:'Credenciamento',catalog:'credentials'},
  secretary:{name:'Dona Sílvia',sprite:'silvia-secretaria.webp',x:85,y:221,direction:0,
    interaction:{x:83,y:247},dialogue:'secretary',label:'Secretaria',catalog:undefined},
  protocol:{name:'Seu Mauro',sprite:'mauro-protocolo.webp',x:548,y:64,direction:0,
    interaction:{x:550,y:91},dialogue:'protocol',label:'Protocolo',catalog:undefined},
  silvio:{name:'Silvio Santos',sprite:'silvio-santos.webp',...mapPoint('Silvio Santos'),direction:0,
    interaction:mapPoint('Balcão do Topa ou Não Topa: atendimento'),dialogue:'topa',label:'Topa ou Não Topa',catalog:undefined},
  snackVendor:{name:'Palmirinha',sprite:'palmirinha.webp',x:886,y:328,direction:0,
    counter:{x:864,y:329},interactionRadius:36,interaction:{x:886,y:356},dialogue:'snacks',label:snackBar.name,catalog:'food'},
} as const;

export const treasurer = {
  name:'Eduardo Cunha', sprite:'eduardo-cunha-tesoureiro.webp', x:427, y:321, direction:0,
  counter:mapPoint('Balcão da tesouraria'), interaction:{x:427,y:361}, label:'Tesouraria',
} as const;

export const mapNpcs = {...npcs,treasurer};

export type NpcId = keyof typeof npcs;
export type DialogueCondition = {
  wallet?:number;
  item?:ObjectKind;
  office?:Office;
  evidence?:EvidenceKind;
  mission?:Agenda;
};

export type DialogueOption = {
  id:string;
  label:string;
  next?:string;
  action?:'shop'|'close'|'swap-missions';
  requires?:DialogueCondition;
  fileItem?:number;
};
export type DialogueNode = {text:string; options:readonly DialogueOption[]};
export const dialogues:Readonly<Record<string,Readonly<Record<string,DialogueNode>>>> = {
  secretary:{
    start:{
      text:'Escolha um projeto. Confira no inventário quantas assinaturas você precisa pedir a outros jogadores antes de levar o documento ao Protocolo.',
      options:[{id:'projects',label:'Solicitar documento'},{id:'leave',label:'Encerrar',action:'close'}],
    },
  },
  protocol:{
    start:{
      text:'Qual documento você quer protocolar? Projetos só precisam das assinaturas exigidas.',
      options:[{id:'leave',label:'Encerrar',action:'close'}],
    },
  },
  topa:{
    start:{
      text:'Você fica com as suas três missões ou troca por tudo que está nos envelopes? A produção me garante que todas são urgentes.',
      options:[
        {id:'trade',label:'Trocar minhas 3 missões',next:'confirm'},
        {id:'leave',label:'Ficar com a minha agenda',action:'close'},
      ],
    },
    confirm:{
      text:'A troca é grátis e vale uma vez por partida. Você perde o progresso das três missões atuais e fica com as recompensas que já ganhou.',
      options:[
        {id:'confirm-trade',label:'Abrir os três envelopes',action:'swap-missions'},
        {id:'leave',label:'Ficar com a minha agenda',action:'close'},
      ],
    },
    swapped:{
      text:'Ma ôe! Três missões novas na sua agenda. Pode levar, que o intervalo comercial acabou!',
      options:[{id:'leave',label:'Encerrar',action:'close'}],
    },
    used:{
      text:'Você já abriu seus três envelopes nesta partida. Agora é com você, meu colega!',
      options:[{id:'leave',label:'Encerrar',action:'close'}],
    },
    unavailable:{
      text:'A produção não conseguiu separar três missões novas agora. Sua agenda continua valendo.',
      options:[{id:'leave',label:'Encerrar',action:'close'}],
    },
  },
  credentials:{
    start:{
      text:'Retratos oficiais e placas para reservar uma cadeira, Excelência.',
      options:[{id:'products',label:'Ver produtos',action:'shop'},{id:'leave',label:'Voltar depois',action:'close'}],
    },
  },
  furniture:{
    start:{
      text:'Excelência, seu gabinete merece um upgrade.',
      options:[{id:'products',label:'Ver móveis',action:'shop'},{id:'leave',label:'Voltar depois',action:'close'}],
    },
  },
  snacks:{
    start:{
      text:'Oi, amiguinho! Tem café passado e lanche quentinho. O que vai ser?',
      options:[
        {id:'products',label:'Ver cardápio',action:'shop'},
        {id:'special',label:'O que saiu agora?',next:'special'},
        {id:'leave',label:'Voltar depois',action:'close'},
      ],
    },
    special:{
      text:'A coxinha saiu agora. A lagosta é para quem veio com a verba do gabinete.',
      options:[
        {id:'products',label:'Ver cardápio',action:'shop'},
        {id:'back',label:'Voltar',next:'start'},
      ],
    },
  },
  convenience:{
    start:{
      text:'Boa tarde, Excelência. Ferramentas de trabalho ou algo que fique fora da prestação de contas?',
      options:[
        {id:'products',label:'Ver produtos',action:'shop'},
        {id:'promotion',label:'Tem alguma promoção?',next:'promotion'},
        {id:'budget',label:'O que dá para levar com R$ 50 mil?',next:'budget',requires:{wallet:5}},
        {id:'coffee',label:'Aceita um cafezinho?',next:'coffee',requires:{item:'coffee'}},
        {id:'president',label:'Tem desconto para a Presidência?',next:'president',requires:{office:'president'}},
        {id:'evidence',label:'A estante também guarda segredos?',next:'evidence',requires:{evidence:'clandestine-transfer'}},
        {id:'mission',label:'Onde fica o cafezinho?',next:'mission',requires:{mission:'cafe'}},
        {id:'leave',label:'Deixa pra lá',action:'close'},
      ],
    },
    coffee:{
      text:'Aceito o café. Quanto à cortesia, o Congresso precisa aprovar primeiro.',
      options:[{id:'back',label:'Voltar',next:'start'}],
    },
    president:{
      text:'A Presidência ganha um recibo em duas vias. O preço é o mesmo.',
      options:[{id:'back',label:'Voltar',next:'start'}],
    },
    evidence:{
      text:'A estante guarda bugigangas. Segredo é melhor levar à Corregedoria.',
      options:[{id:'back',label:'Voltar',next:'start'}],
    },
    mission:{
      text:'Volte pelo corredor e procure o Cafezinho à esquerda.',
      options:[{id:'back',label:'Voltar',next:'start'}],
    },
    budget:{
      text:'Por esse valor dá para sair com um colete e um binóculo. Discrição cobrada à parte.',
      options:[{id:'products',label:'Ver produtos',action:'shop'},{id:'back',label:'Voltar',next:'start'}],
    },
    promotion:{
      text:'Tem sim. Na compra de qualquer item, o recibo já sai com cara de documento sigiloso.',
      options:[
        {id:'products',label:'Ver produtos',action:'shop'},
        {id:'back',label:'Voltar',next:'start'},
        {id:'leave',label:'Deixa pra lá',action:'close'},
      ],
    },
  },
};

export type DialogueView = {
  npc:NpcId;
  text:string;
  options:readonly Pick<DialogueOption,'id'|'label'>[];
  shop:boolean;
  direct?:boolean;
  feedback?:string;
  token:number;
};
