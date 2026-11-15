export const stationRecharge = {
  coffee:{duration:10_000,texture:'coffee-maker',feedback:'A cafeteira está preparando o próximo café.'},
} as const;

export type RechargeStation = keyof typeof stationRecharge;
