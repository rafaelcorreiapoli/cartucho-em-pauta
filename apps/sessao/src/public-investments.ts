export const investmentAreas = {
  health:'Saúde',
  safety:'Segurança',
  supplies:'Abastecimento',
  transport:'Transporte',
} as const;

export const investmentAmounts = [2,4,6] as const;
export const diversionPercentages = [0,25,50] as const;

export type InvestmentArea = keyof typeof investmentAreas;
export type InvestmentAmount = typeof investmentAmounts[number];
export type DiversionPercentage = typeof diversionPercentages[number];
export type PublicInvestment = {area:InvestmentArea; amount:InvestmentAmount; diversion:DiversionPercentage};
export type InvestmentAnnouncement = {author:string; area:InvestmentArea; amount:InvestmentAmount};

export const investmentRules = {
  cooldownMs:60_000,
  stabilityPerUnit:2,
  hpPerUnit:1,
  durationPerUnitMs:3000,
  suppliesDiscount:30,
  transportSpeedBonus:20,
} as const;

export function investmentImpact(amount:InvestmentAmount,diversion:DiversionPercentage) {
  const diverted = amount*diversion/100;
  const invested = amount-diverted;
  return {
    invested,diverted,
    stability:Math.floor(invested*investmentRules.stabilityPerUnit),
    hp:Math.floor(invested*investmentRules.hpPerUnit),
    duration:invested*investmentRules.durationPerUnitMs,
  };
}
