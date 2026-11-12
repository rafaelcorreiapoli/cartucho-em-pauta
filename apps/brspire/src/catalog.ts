import { regionalStages } from "./campaign-states";

export type Card = {
  name: string;
  image: string;
  cost: number;
  line: string;
  damage?: number;
  guardDamage?: boolean;
  retainGuard?: number;
  guardAfterStrength?: number;
  extraHitAtStrength?: number;
  guard?: number;
  draw?: number;
  all?: boolean;
  hits?: number;
  energy?: number;
  heal?: number;
  nextEnergy?: number;
  coins?: number;
  doubleGuard?: boolean;
  moralCost?: number;
  exhaust?: boolean;
  election?: boolean;
  strength?: number;
  turnStrength?: number;
  strengthGrowthTurns?: number;
  discardBeforeDraw?: boolean;
  unplayable?: boolean;
  addPayroll?: boolean;
  guardAfterCoins?: number;
  guardBonus?: number;
  delayedDamage?: number;
  repeatTactic?: boolean;
  extraHitAfterTactic?: boolean;
  moralWithoutDamage?: number;
  nextMoralCost?: number;
  weakenAttack?: number;
  blockDebuff?: boolean;
  endTurn?: boolean;
};

export const cards = {
  militant: {
    name: "Militante da Federal",
    image: "militant",
    cost: 1,
    damage: 6,
    line: "Faixa e ata.",
  },
  nurse: {
    name: "Médico Cubano",
    image: "nurse",
    cost: 1,
    guard: 5,
    line: "Pegue a senha.",
  },
  radio: {
    name: "Sindicalista",
    image: "radio",
    cost: 1,
    damage: 4,
    guard: 4,
    line: "Cota sindical.",
  },
  megaphone: {
    name: "Panfleteiro Contrato",
    image: "megaphone",
    cost: 1,
    damage: 5,
    all: true,
    line: "Megafone incluso.",
  },
  delegate: {
    name: "Jones Manoel",
    image: "delegate",
    cost: 2,
    damage: 15,
    line: "Com bibliografia.",
  },
  scout: {
    name: "Guerrilheiro",
    image: "card-guerrilheiro",
    cost: 1,
    damage: 5,
    draw: 1,
    line: "Fora do mapa.",
  },
  foreman: {
    name: "Professor de História",
    image: "card-professor-historia",
    cost: 2,
    damage: 15,
    line: "Prazo quinquenal.",
  },
  fazOL: {
    name: "Faz o L",
    image: "card-faz-o-l",
    cost: 1,
    guard: 8,
    line: "Gesto blindado.",
  },
  mensalao: {
    name: "Mensalão",
    image: "card-mensalao",
    cost: 1,
    heal: 5,
    exhaust: true,
    line: "Ânimo em espécie.",
  },
  estocarVento: {
    name: "Estocar Vento",
    image: "card-estocar-vento",
    cost: 1,
    guard: 4,
    nextEnergy: 2,
    line: "Fecha a tampa.",
  },
  dinheiroNaCueca: {
    name: "Dinheiro na Cueca",
    image: "card-dinheiro-na-cueca",
    cost: 1,
    coins: 8,
    exhaust: true,
    line: "Bolso pequeno.",
  },
  dobraMeta: {
    name: "Dobra a Meta",
    image: "card-dobra-a-meta",
    cost: 1,
    doubleGuard: true,
    line: "Cadê a meta?",
  },
  mulherSapiens: {
    name: "Mulher Sapiens",
    image: "card-mulher-sapiens",
    cost: 1,
    damage: 4,
    hits: 3,
    line: "Darwin por turnos.",
  },
  monstroCoronavirus: {
    name: "O Monstro do Coronavírus",
    image: "card-monstro-coronavirus",
    cost: 1,
    damage: 9,
    all: true,
    moralCost: 3,
    line: "Contágio nacional.",
  },
  saudacaoMandioca: {
    name: "Saudação à Mandioca",
    image: "card-saudacao-mandioca",
    cost: 1,
    guard: 6,
    draw: 1,
    line: "Raiz de Estado.",
  },
  minhaCasa: {
    name: "Minha Casa, Minha Vida",
    image: "card-minha-casa-minha-vida",
    cost: 2,
    guard: 14,
    line: "Teto a prazo.",
  },
  comunistaIphone: {
    name: "Comunista de iPhone",
    image: "card-comunista-iphone",
    cost: 0,
    energy: 1,
    exhaust: true,
    line: "Revolução: 1%.",
  },
  bolsaFamilia: {
    name: "Bolsa Família",
    image: "card-bolsa-familia",
    cost: 1,
    guard: 5,
    heal: 4,
    exhaust: true,
    line: "Picanha pendente.",
  },
  pixMei: {
    name: "Pix MEI",
    image: "card-pix-mei",
    cost: 0,
    coins: 5,
    draw: 1,
    exhaust: true,
    line: "Pix sem recibo.",
  },
  petrolao: {
    name: "Petrolão",
    image: "card-petrolao",
    cost: 2,
    damage: 8,
    all: true,
    coins: 12,
    moralCost: 3,
    exhaust: true,
    line: "A planilha vazou.",
  },
  quedaBolsa: {
    name: "Queda de Bolsa",
    image: "card-queda-de-bolsa",
    cost: 2,
    damage: 11,
    all: true,
    line: "O mercado sentiu.",
  },
  subidaJuros: {
    name: "Subida de Juros",
    image: "card-subida-de-juros",
    cost: 2,
    damage: 5,
    hits: 3,
    line: "Em três parcelas.",
  },
  anoEleicao: {
    name: "Ano de Eleição",
    image: "card-ano-de-eleicao",
    cost: 3,
    election: true,
    exhaust: true,
    line: "A conta vem depois.",
  },
  greveDoAbc: {
    name: "Greve do ABC",
    image: "card-greve-do-abc",
    cost: 2,
    strengthGrowthTurns: 3,
    exhaust: true,
    line: "O ABC parou.",
  },
  triplexGuaruja: {
    name: "Triplex Guarujá",
    image: "card-triplex-guaruja",
    cost: 1,
    strength: 2,
    exhaust: true,
    line: "Elevador em perícia.",
  },
  entrarOGrosso: {
    name: "Entrar o Grosso",
    image: "card-entrar-o-grosso",
    cost: 0,
    turnStrength: 2,
    exhaust: true,
    line: "Agora vai.",
  },
  lavaJato: {
    name: "Lava Jato",
    image: "card-lava-jato",
    cost: 2,
    damage: 10,
    guard: 7,
    line: "Mandado cumprido.",
  },
  cadeiraDatena: { name: "Cadeira do Datena", image: "card-cadeira-do-datena", cost: 2, damage: 18, endTurn: true, line: "Debate em dois tempos." },
  estatizar: { name: "Estatizar", image: "card-estatizar", cost: 2, guard: 10, nextEnergy: 1, line: "O carimbo já chegou." },
  pedaladaFiscal: { name: "Pedalada Fiscal", image: "card-pedalada-fiscal", cost: 1, guardDamage: true, line: "A conta ficou para o próximo exercício." },
  estoqueRegulador: { name: "Estoque Regulador", image: "card-estoque-regulador", cost: 1, guard: 6, retainGuard: 6, line: "A mandioca está sob custódia." },
  piquete: { name: "Piquete", image: "card-piquete", cost: 1, guard: 5, guardAfterStrength: 4, line: "A catraca aderiu à greve." },
  assembleiaGeral: { name: "Assembleia Geral", image: "card-assembleia-geral", cost: 1, damage: 3, hits: 2, extraHitAtStrength: 3, line: "A oposição estava do lado de fora." },
  creditoSuplementar: { name: "Crédito Suplementar", image: "card-credito-suplementar", cost: 0, coins: 10, draw: 1, exhaust: true, line: "Não estava no orçamento. Agora está." },
  fariaLimer: { name: "Faria Limer", image: "card-faria-limer", cost: 1, damage: 6, line: "O mercado reagiu." },
  cidadaoDeBem: { name: "Cidadão de Bem", image: "card-cidadao-de-bem", cost: 1, guard: 5, line: "Foi legítima defesa." },
  tiozaoZap: { name: "Tiozão do Zap", image: "card-tiozao-do-zap", cost: 0, draw: 1, discardBeforeDraw: true, line: "Confia. Veio de um general." },
  rachadinha: { name: "Rachadinha", image: "card-rachadinha", cost: 1, coins: 12, addPayroll: true, exhaust: true, line: "A conta fecha na outra planilha." },
  folhaPagamento: { name: "Folha de Pagamento", image: "card-folha-de-pagamento", cost: 0, unplayable: true, line: "Favor rubricar todas as vias." },
  beachTennis: { name: "Beach Tennis", image: "card-beach-tennis", cost: 1, damage: 4, hits: 2, line: "Saque de condomínio." },
  hinoProPneu: { name: "Hino pro Pneu", image: "card-hino-pro-pneu", cost: 1, guard: 6, guardBonus: 1, line: "Em posição de sentido." },
  jacarePfizer: { name: "Jacaré da Pfizer", image: "card-jacare-da-pfizer", cost: 1, strength: 2, exhaust: true, line: "A gravata ainda serve." },
  privatizar: { name: "Privatizar", image: "card-privatizar", cost: 0, coins: 14, moralCost: 3, exhaust: true, line: "Vendido no primeiro lance." },
  cloroquina: { name: "Cloroquina", image: "card-cloroquina", cost: 1, guard: 13, nextMoralCost: 3, line: "O efeito colateral vem depois." },
  gripezinha: { name: "Gripezinha", image: "card-gripezinha", cost: 1, weakenAttack: 7, line: "Histórico de atleta." },
  niobio: { name: "Nióbio", image: "card-niobio", cost: 1, guard: 6, guardAfterCoins: 6, line: "É só vender que decola." },
  patriotaCaminhao: { name: "Patriota do Caminhão", image: "card-patriota-do-caminhao", cost: 1, guard: 5, delayedDamage: 8, line: "Eu desço no próximo posto." },
  gabineteOdio: { name: "Gabinete do Ódio", image: "card-gabinete-do-odio", cost: 1, repeatTactic: true, exhaust: true, line: "Espontâneo. Às 8h em ponto." },
  imbrochavel: { name: "Imbrochável", image: "card-imbrochavel", cost: 0, turnStrength: 2, moralWithoutDamage: 3, exhaust: true, line: "Precisou anunciar no microfone." },
  bolsominion: { name: "Bolsominion", image: "card-bolsominion", cost: 1, damage: 5, extraHitAfterTactic: true, line: "Recebeu a ordem em áudio." },
  chapeuAluminio: { name: "Chapéu de Alumínio", image: "card-chapeu-de-aluminio", cost: 1, guard: 4, blockDebuff: true, line: "A única coisa que não pega é sinal." },
} satisfies Record<string, Card>;

export type CardId = keyof typeof cards;
export type DeckCardId = CardId | `${CardId}+`;

export function cardDefinition(id: DeckCardId): Card {
  if (!id.endsWith("+")) return cards[id as CardId];
  const card: Card = cards[id.slice(0, -1) as CardId];
  if (card.unplayable) return card;
  const upgraded = { ...card, name: `${card.name}+` };
  if (card.damage) upgraded.damage = card.damage + (card.hits ? 1 : 3);
  else if (card.guard) upgraded.guard = card.guard + 3;
  else if (card.heal) upgraded.heal = card.heal + 3;
  else if (card.coins) upgraded.coins = card.coins + 3;
  else if (card.energy) upgraded.energy = card.energy + 1;
  else if (card.strength) upgraded.strength = card.strength + 1;
  else if (card.turnStrength) upgraded.turnStrength = card.turnStrength + 1;
  else if (card.strengthGrowthTurns) upgraded.strengthGrowthTurns = card.strengthGrowthTurns + 1;
  else if (card.weakenAttack) upgraded.weakenAttack = card.weakenAttack + 3;
  else if (card.discardBeforeDraw) upgraded.draw = 2;
  else if (card.repeatTactic) upgraded.cost = 0;
  else if (card.guardDamage) upgraded.cost = 0;
  else if (card.doubleGuard) upgraded.guard = 2;
  return upgraded;
}

export const startingDeck: readonly CardId[] = [
  "anoEleicao",
  "militant",
  "militant",
  "militant",
  "militant",
  "nurse",
  "nurse",
  "nurse",
  "nurse",
  "radio",
];
export const rewardPool: readonly CardId[] = [
  "megaphone",
  "delegate",
  "fazOL",
  "mensalao",
  "estocarVento",
  "dinheiroNaCueca",
  "dobraMeta",
  "mulherSapiens",
  "monstroCoronavirus",
  "saudacaoMandioca",
  "minhaCasa",
  "comunistaIphone",
  "bolsaFamilia",
  "pixMei",
  "petrolao",
  "quedaBolsa",
  "subidaJuros",
  "greveDoAbc",
  "triplexGuaruja",
  "entrarOGrosso",
  "lavaJato",
  "cadeiraDatena",
  "estatizar",
  "pedaladaFiscal", "estoqueRegulador", "piquete", "assembleiaGeral", "creditoSuplementar",
];

export const rightRewardPool: readonly CardId[] = [
  "beachTennis", "hinoProPneu", "jacarePfizer", "privatizar", "cloroquina",
  "gripezinha", "niobio", "patriotaCaminhao", "gabineteOdio", "imbrochavel", "bolsominion", "chapeuAluminio",
];

export function cardType(card: Card) {
  if (card.unplayable) return "status";
  if ((card.damage || card.guardDamage) && !card.guard) return "offensive";
  if (card.guard && !card.damage && !card.delayedDamage && !card.guardAfterCoins) return "defensive";
  return "tactical";
}

export function needsTarget(card: Card) {
  return !card.all && Boolean(card.damage || card.guardDamage || card.delayedDamage);
}

export type Intent = { kind: "attack" | "guard" | "rally" | "stamp" | "counter" | "predict" | "teamGuard" | "heal" | "summon" | "doubleGuard" | "injunction" | "jingle" | "research" | "wait"; value: number; label?: string; guardValue?: number };
export type Rival = {
  id: string;
  name: string;
  moral: number;
  intents: readonly Intent[];
  secondPhase?: readonly Intent[];
  sprite?: string;
};

export const campaignRivals = {
  havan: { id: "havan", name: "Véio da Havan", moral: 38, intents: [
    { kind: "attack", value: 5, label: "Parcela em 12x" },
    { kind: "attack", value: 4, label: "Segunda parcela" },
    { kind: "attack", value: 4, label: "Terceira parcela" },
    { kind: "guard", value: 7 },
  ] },
  moro: { id: "moro", name: "Sérgio Moro", moral: 46, intents: [
    { kind: "stamp", value: 1, label: "Recurso Negado" },
    { kind: "attack", value: 10 },
    { kind: "guard", value: 6 },
  ] },
  jefferson: { id: "jefferson", name: "Roberto Jefferson", moral: 52, intents: [
    { kind: "guard", value: 10, label: "Não Vou Descer" },
    { kind: "counter", value: 16, label: "Contra-ataque" },
    { kind: "attack", value: 8 },
  ] },
  olavo: { id: "olavo", name: "Olavo de Carvalho", moral: 42, intents: [
    { kind: "predict", value: 10, label: "Eu Já Tinha Avisado" },
    { kind: "attack", value: 8 },
    { kind: "predict", value: 10, label: "Eu Já Tinha Avisado" },
  ] },
} satisfies Record<string, Rival>;

export const leftRivals: readonly Rival[] = [
  { id: "lula", name: "Lula", moral: 32, intents: [
    { kind: "attack", value: 7 }, { kind: "rally", value: 2 }, { kind: "attack", value: 10 },
  ], secondPhase: [
    { kind: "rally", value: 2, label: "Ano de Eleição" },
    { kind: "attack", value: 12, label: "Vai Entrar o Grosso" },
    { kind: "attack", value: 9, label: "Segundo Turno" },
  ] },
  { id: "che", name: "Che Guevara", moral: 29, intents: [
    { kind: "attack", value: 9, label: "Emboscada da Sierra" }, { kind: "rally", value: 2 },
    { kind: "attack", value: 12 }, { kind: "guard", value: 6 },
  ] },
  { id: "stalin", name: "Stalin", moral: 36, intents: [
    { kind: "guard", value: 8 }, { kind: "counter", value: 14 },
    { kind: "stamp", value: 1, label: "Plano Quinquenal" }, { kind: "attack", value: 8 },
  ] },
];

type Encounter = {
  name: string;
  subtitle: string;
  state: string;
  arena: string;
  marker: readonly [number, number];
  uf: string;
  rivals: readonly Rival[];
};

const originalEncounters: readonly Encounter[] = [
  {
    name: "Quebra-pau no MASP",
    subtitle: "Avenida Paulista · MASP",
    state: "São Paulo",
    arena: "arena-sp",
    marker: [348, 363],
    uf: "sp",
    rivals: [
      {
        id: "pavanato",
        name: "Lucas Pavanato",
        moral: 28,
        intents: [
          { kind: "attack", value: 7 },
          { kind: "guard", value: 5 },
          { kind: "attack", value: 10 },
        ],
      },
    ],
  },
  {
    name: "Bate-boca na Ladeira",
    subtitle: "Comunidade na encosta",
    state: "Rio de Janeiro",
    arena: "arena-rj",
    marker: [390, 354],
    uf: "rj",
    rivals: [
      {
        id: "trump",
        name: "Trump",
        moral: 13,
        intents: [
          { kind: "attack", value: 4 },
          { kind: "guard", value: 5 },
          { kind: "attack", value: 7 },
        ],
      },
      {
        id: "mamae-falei",
        name: "Mamãe Falei",
        moral: 17,
        intents: [
          { kind: "rally", value: 2 },
          { kind: "attack", value: 6 },
          { kind: "attack", value: 7 },
        ],
      },
      {
        id: "marcal",
        name: "Pablo Marçal",
        moral: 15,
        intents: [
          { kind: "attack", value: 6 },
          { kind: "attack", value: 4 },
          { kind: "guard", value: 6 },
        ],
      },
    ],
  },
  {
    name: "Barraco na Orla",
    subtitle: "Orla de Salvador",
    state: "Bahia",
    arena: "arena-ba",
    marker: [420, 224],
    uf: "ba",
    rivals: [
      {
        id: "nando-moura",
        name: "Nando Moura",
        moral: 20,
        intents: [
          { kind: "guard", value: 4 },
          { kind: "attack", value: 9 },
          { kind: "attack", value: 6 },
        ],
      },
      {
        id: "nikolas-ferreira",
        name: "Nikolas Ferreira",
        moral: 18,
        intents: [
          { kind: "attack", value: 5 },
          { kind: "rally", value: 2 },
          { kind: "attack", value: 6 },
        ],
      },
    ],
  },
  {
    name: "Treta na Esplanada",
    subtitle: "Esplanada dos Ministérios · Chefe",
    state: "Distrito Federal",
    arena: "arena-df",
    marker: [333, 269],
    uf: "df",
    rivals: [
      {
        id: "bolsonaro",
        name: "Bolsonaro",
        moral: 57,
        secondPhase: [
          { kind: "rally", value: 2, label: "Imbrochável" },
          { kind: "attack", value: 13, label: "Motociata" },
          { kind: "attack", value: 9, label: "Cercadinho" },
        ],
        intents: [
          { kind: "attack", value: 9 },
          { kind: "guard", value: 8 },
          { kind: "attack", value: 14 },
          { kind: "rally", value: 2 },
          { kind: "attack", value: 10 },
        ],
      },
    ],
  },
];

export const regionalRivals = originalEncounters.slice(0, 3).flatMap(({ rivals }) => rivals);
export const encounters = [
  ...originalEncounters,
  ...regionalStages.map(([uf, state, name, subtitle, x, y], index): Encounter => {
    const rival = regionalRivals[index % regionalRivals.length];
    const partner = regionalRivals[(index + 2) % regionalRivals.length];
    return {
      uf, state, name, subtitle,
      arena: `arena-${uf}`,
      marker: [x, y],
      rivals: index % 3 === 0
        ? [{ ...rival, moral: 29 + index % 8 }]
        : [{ ...rival, moral: 15 + index % 5 }, { ...partner, moral: 13 + index % 4 }],
    };
  }),
];

export const campaignLength = encounters.length;
