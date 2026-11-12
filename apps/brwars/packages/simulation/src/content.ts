export type Side = 'left' | 'right';
export type BuildingKind =
  | 'barracks'
  | 'media'
  | 'garage'
  | 'civic'
  | 'housing'
  | 'bank'
  | 'academy'
  | 'school'
  | 'hospital'
  | 'workplace'
  | 'park'
  | 'depot';
export type UnitKind = 'front' | 'ranged' | 'siege' | 'hero' | 'medic';
export const SIDES: Side[] = ['left', 'right'];
export const opposite = (side: Side): Side => (side === 'left' ? 'right' : 'left');
export const FACTIONS = {
  left: {
    worker: 'Operário sindicalizado',
    name: 'Esquerda',
    motto: 'O povo ocupa. A base avança.',
    hero: 'Jones Manoel',
    heroAbility: 'Organização de base',
    color: '#e67560',
    units: {
      medic: 'Médico Cubano',
      front: 'Militante do MST',
      ranged: 'Sindicalista',
      siege: 'Carro de som',
      hero: 'Jones Manoel',
    },
    buildings: {
      barracks: 'Sindicato',
      media: 'Rádio do Sindicato',
      garage: 'Garagem do Sindicato',
      civic: 'Sarau da Rouanet',
      housing: 'Ocupação MST',
      bank: 'Caixa do Povo',
      academy: 'Federal Sucateada',
      school: 'Escolinha Paulo Freire',
      hospital: 'Postinho do SUS',
      workplace: 'Coop. do Povo',
      park: 'Praça da Reforma',
      depot: 'Armazém do Mutirão',
    },
  },
  right: {
    worker: 'PJ de capacete',
    name: 'Direita',
    motto: 'O mercado abre. A base avança.',
    hero: 'Mamãe Falei',
    heroAbility: 'Fiscalização de campo',
    color: '#e7bf57',
    units: {
      medic: 'Médico do Convênio',
      front: 'Faria Limer',
      ranged: 'Tio do Zap',
      siege: 'Carro de som',
      hero: 'Mamãe Falei',
    },
    buildings: {
      barracks: 'Escritório',
      media: 'Central do Zap',
      garage: 'Garagem da Havan',
      civic: 'Arena XP',
      housing: 'Studio Faria Lima',
      bank: 'Banco do Primo Rico',
      academy: 'INSPER',
      school: 'Colégio do Mérito',
      hospital: 'Hospital Particular',
      workplace: 'Startup',
      park: 'Praça do CNPJ',
      depot: 'Galpão do Frete Grátis',
    },
  },
} as const;
export const BUILDINGS: Record<
  BuildingKind,
  {
    cost: number;
    constructionTime: number;
    interval: number;
    unit: UnitKind | null;
    popularityYield: number;
    popularityRate?: number;
    description: string;
  }
> = {
  park: {
    cost: 420,
    constructionTime: 22,
    interval: 0,
    unit: null,
    popularityYield: 9,
    popularityRate: 0.75,
    description: 'Inaugura com +9 POP e gera até +0,75 POP/s. Cópias têm retorno decrescente.',
  },
  depot: {
    cost: 600,
    constructionTime: 25,
    interval: 0,
    unit: null,
    popularityYield: 0,
    description: 'Acelera fábricas automáticas em 15%. O segundo galpão soma 8 pontos percentuais.',
  },
  workplace: {
    cost: 300,
    constructionTime: 18,
    interval: 0,
    unit: null,
    popularityYield: 0,
    description: 'Gera 12 empregos, +4 por nível adicional. Requer trabalhadores para gerar renda.',
  },
  barracks: {
    cost: 180,
    constructionTime: 10,
    interval: 8,
    unit: 'front',
    popularityYield: 0,
    description: 'Linha de frente resistente. Produz a cada 8s.',
  },
  media: {
    cost: 240,
    constructionTime: 15,
    interval: 10,
    unit: 'ranged',
    popularityYield: 0,
    description: 'Ataques à distância. Produz a cada 10s.',
  },
  garage: {
    cost: 320,
    constructionTime: 20,
    interval: 15,
    unit: 'siege',
    popularityYield: 0,
    description: 'Dano dobrado contra a base. Produz a cada 15s.',
  },
  civic: {
    cost: 280,
    constructionTime: 18,
    interval: 0,
    unit: null,
    popularityYield: 6,
    popularityRate: 0.6,
    description: 'Gera até +0,6 POP/s. Cópias do mesmo tipo têm retorno decrescente.',
  },
  housing: {
    cost: 200,
    constructionTime: 12,
    interval: 0,
    unit: null,
    popularityYield: 0,
    description:
      'Aumenta a população máxima em 6, +2 por nível adicional. Só funciona depois de pronta.',
  },
  bank: {
    cost: 220,
    constructionTime: 12,
    interval: 0,
    unit: null,
    popularityYield: 0,
    description: 'Libera crédito e aplicações. Limite e ofertas acompanham a renda sustentável.',
  },
  academy: {
    cost: 1800,
    constructionTime: 45,
    interval: 0,
    unit: null,
    popularityYield: 11,
    popularityRate: 1.1,
    description:
      'Pesquisa reformas avançadas e estruturais. Gera até +1,1 POP/s, com retorno decrescente próprio e',
  },
  school: {
    cost: 650,
    constructionTime: 25,
    interval: 0,
    unit: null,
    popularityYield: 8,
    popularityRate: 0.8,
    description:
      'Pesquisa treinamento e mobilidade. Gera até +0,8 POP/s. retorno decrescente próprio.',
  },
  hospital: {
    cost: 1200,
    constructionTime: 35,
    interval: 0,
    unit: null,
    popularityYield: 10,
    popularityRate: 1,
    description:
      'Treina médicos e recupera heróis. Gera até +1 POP/s. Retorno decrescente próprio, separado das escolas e Feira/Estádio.',
  },
};
export const BUILDING_REQUIREMENTS: Partial<Record<BuildingKind, readonly BuildingKind[]>> = {
  academy: ['school'],
  depot: ['workplace'],
  garage: ['media'],
  hospital: ['school'],
};
export const UNITS: Record<
  UnitKind,
  { hp: number; damage: number; range: number; speed: number; interval: number }
> = {
  front: { hp: 125, damage: 15, range: 23, speed: 23, interval: 1.1 },
  ranged: { hp: 65, damage: 18, range: 110, speed: 19, interval: 1.5 },
  siege: { hp: 160, damage: 26, range: 80, speed: 13, interval: 2.4 },
  medic: { hp: 100, damage: 0, range: 140, speed: 20, interval: 1 },
  hero: { hp: 520, damage: 35, range: 46, speed: 21, interval: 1.1 },
};
export const WORKER_COST = 120;
export const HERO_COST = 480;
export const UNIT_PRODUCTION_COST = {
  worker: WORKER_COST,
  front: 40,
  ranged: 55,
  siege: 100,
  hero: HERO_COST,
  medic: 220,
} as const;
export const POPULATION_COST = {
  worker: 1,
  front: 1,
  ranged: 1,
  siege: 2,
  hero: 3,
  medic: 2,
} as const;
export const BASE_POPULATION_CAP = 12;
export const MAX_POPULATION = 200;
export const BASE_HP = 5000;

export const MAX_BUILDING_LEVEL = 15;

export const POPULARITY_CAP = 200;
export const GLOBAL_POWER = {
  name: 'Chuva de boletos',
  cost: 60,
  cooldown: 45,
  damageFraction: 0.4,
  description:
    'Uma tempestade de cobranças causa 40% da vida máxima de dano a todas as unidades inimigas. Não atinge aliados nem bases.',
} as const;

export const PLOT_COLUMNS = 8;
export const BUILDING_SLOTS = 48;
export const INITIAL_PLOTS = [0, 1, 2, 3, 4, 5] as const;
export const PLOT_COST = 150;
export const GLOBAL_POWERS = {
  bills: GLOBAL_POWER,
  recall: {
    name: 'Recuar tropas',
    cost: 80,
    cooldown: 45,
    duration: 0,
    description:
      'Faz cada tropa inimiga recuar metade do trajeto percorrido, sem passar do ponto inicial.',
  },
  silence: {
    name: 'Modo avião',
    cost: 70,
    cooldown: 45,
    duration: 6,
    description:
      'As tropas inimigas em campo ficam sem atacar por 6 segundos. Elas ainda podem se mover.',
  },
  strength: {
    name: 'Agora vai!',
    cost: 75,
    cooldown: 45,
    duration: 10,
    multiplier: 2,
    description:
      'Dobra o dano das suas tropas em campo por 10 segundos. Não aumenta vida nem velocidade.',
  },
  sabotage: {
    name: 'Corte de Ponto',
    cost: 110,
    cooldown: 90,
    description:
      'Elimina 3 trabalhadores adversários. Elimina 4 a partir de 10 trabalhadores e 5 a partir de 20.',
  },
} as const;
export type GlobalPowerKind = keyof typeof GLOBAL_POWERS;
export const spawnPosition = (side: Side) => (side === 'left' ? 150 : 850);

export const BASE_QUEUE_LIMIT = 5;
export const BASE_PRODUCTION = { worker: 5, hero: 12 } as const;

export const PROMOTION_OFFERS = {
  local: { name: 'Mobilização local', cash: 180, popularity: 15, duration: 6 },
  event: { name: 'Grande evento', cash: 600, popularity: 60, duration: 15 },
} as const;
export type PromotionKind = keyof typeof PROMOTION_OFFERS;

export const BUILDING_HOTKEYS: Record<Side, Record<BuildingKind, string>> = {
  left: {
    barracks: 'm',
    media: 'r',
    garage: 'g',
    civic: 'c',
    housing: 'o',
    bank: 'b',
    academy: 'u',
    school: 'e',
    hospital: 'h',
    workplace: 'f',
    park: 'q',
    depot: 'l',
  },
  right: {
    barracks: 'h',
    media: 'c',
    garage: 'g',
    civic: 'e',
    housing: 'a',
    bank: 'b',
    academy: 'i',
    school: 'o',
    hospital: 'p',
    workplace: 'f',
    park: 'q',
    depot: 'l',
  },
};

export const COMBAT_LEVEL_BONUS = 0.05;
export function globalPowerName(kind: GlobalPowerKind, side: Side) {
  return kind === 'recall'
    ? side === 'left'
      ? 'Recua Fascista Recua!'
      : 'Volta pra Cuba!'
    : GLOBAL_POWERS[kind].name;
}

export function recallPosition(x: number, side: Side) {
  const origin = spawnPosition(side),
    direction = side === 'left' ? 1 : -1;
  return origin + direction * Math.max(0, direction * (x - origin)) * 0.5;
}
