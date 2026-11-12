export const money = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
