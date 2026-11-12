export const npcs = {
  vendor:{name:'Seu Balcão',character:4,x:631,y:208,direction:0,dialogue:'convenience',label:'Mercado Parlamentar'},
} as const;

export type NpcId = keyof typeof npcs;
export type DialogueOption = {
  id:string;
  label:string;
  next?:string;
  action?:'shop'|'close';
  requires?:{wallet?:number};
};
export type DialogueNode = {text:string; options:readonly DialogueOption[]};
export const dialogues:Readonly<Record<string,Readonly<Record<string,DialogueNode>>>> = {
  convenience:{
    start:{
      text:'Boa tarde, Excelência. Ferramentas de trabalho ou algo que fique fora da prestação de contas?',
      options:[
        {id:'products',label:'Ver produtos',action:'shop'},
        {id:'promotion',label:'Tem alguma promoção?',next:'promotion'},
        {id:'budget',label:'O que dá para levar com R$ 50 mil?',next:'budget',requires:{wallet:5}},
        {id:'leave',label:'Deixa pra lá',action:'close'},
      ],
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
