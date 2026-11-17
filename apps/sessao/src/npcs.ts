import { mapDoor, mapPoint, roomBounds } from './congress-layout';
import type { Office } from './elections';
import type { ObjectKind } from './gameplay';
import type { Agenda, EvidenceKind } from './politics';

export const snackBar = {
  name:'Lanchonete', bounds:roomBounds('Lanchonete'), door:mapDoor('Lanchonete'),
} as const;

export const npcs = {
  vendor:{name:'Doutor Gambiarra',sprite:'doutor-gambiarra.webp',portrait:'retrato-doutor-gambiarra.webp',x:675,y:231,direction:0,dialogue:'convenience',label:'Apoio Técnico',catalog:'equipment'},
  furnitureVendor:{name:'Roberto Justus',sprite:'roberto-justus.webp',portrait:'retrato-roberto-justus.webp',x:525,y:451,direction:0,
    interaction:{x:530,y:466},dialogue:'furniture',label:'Gabinete de Luxo',catalog:'furniture'},
  credentialsVendor:{name:'Carmem Carimbo',sprite:'carmem-carimbo.webp',portrait:'retrato-carmem-carimbo.webp',x:160,y:473,direction:0,
    interaction:{x:149,y:493},dialogue:'credentials',label:'Credenciamento',catalog:'credentials'},
  snackVendor:{name:'Palmirinha',sprite:'palmirinha.webp',x:886,y:328,direction:0,
    counter:{x:864,y:329},interactionRadius:36,interaction:{x:886,y:356},dialogue:'snacks',label:snackBar.name,catalog:'food'},
} as const;

export const treasurer = {
  name:'Eduardo Cunha', sprite:'eduardo-cunha-tesoureiro.webp', x:403, y:446, direction:0,
  counter:mapPoint('Balcão da tesouraria'), interaction:{x:403,y:486}, label:'Tesouraria',
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
  action?:'shop'|'close';
  requires?:DialogueCondition;
};
export type DialogueNode = {text:string; options:readonly DialogueOption[]};
export const dialogues:Readonly<Record<string,Readonly<Record<string,DialogueNode>>>> = {
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
  token:number;
};
