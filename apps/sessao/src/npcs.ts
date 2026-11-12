import type { Office } from './elections';
import type { ObjectKind } from './gameplay';
import type { Agenda, EvidenceKind } from './politics';

export const snackBar = {
  name:'Lanchonete', bounds:[824,270,126,122], door:[853,259,44,11],
} as const;

export const npcs = {
  vendor:{name:'Seu Balcão',character:4,x:631,y:208,direction:0,counter:{x:609,y:214},dialogue:'convenience',label:'Mercado Parlamentar',catalog:'equipment'},
  snackVendor:{name:'Tia do Lanche',sprite:'tia-do-lanche.webp',x:886,y:328,direction:0,
    counter:{x:864,y:329},interaction:{x:886,y:356},dialogue:'snacks',label:snackBar.name,catalog:'food'},
} as const;

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
  action?:'shop'|'close';
  requires?:DialogueCondition;
};
export type DialogueNode = {text:string; options:readonly DialogueOption[]};
export const dialogues:Readonly<Record<string,Readonly<Record<string,DialogueNode>>>> = {
  snacks:{
    start:{
      text:'Chega mais, Excelência. Tem café passado e lanche quente. O que vai ser?',
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
        {id:'evidence',label:'O balcão também guarda segredos?',next:'evidence',requires:{evidence:'clandestine-transfer'}},
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
      text:'O balcão guarda troco. Segredo é melhor levar à Controladoria.',
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
  token:number;
};
