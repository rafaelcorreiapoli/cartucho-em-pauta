export const consumableSlots = 3;

export const relics = {
  poteVento: { name: "Pote de Vento", image: "item-pote-vento", price: 100, description: "Mantenha até 4 de Guarda entre turnos.", flavor: "Abre só em caso de déficit." },
  carteiraSindicato: { name: "Carteirinha do Sindicato", image: "item-carteira-sindicato", price: 105, description: "Na primeira vez que alcançar 3 de Força no combate, ganhe 7 de Guarda e compre 1 carta.", flavor: "A contribuição vem descontada." },
  carimboTcu: { name: "Carimbo do TCU", image: "item-carimbo-tcu", price: 90, description: "Na primeira jogada que te deixaria no negativo em cada combate, cubra até 10 moedas do rombo.", flavor: "Aprovado com ressalvas. Todas." },
  carteiraBandejao: { name: "Carteirinha do Bandejão", image: "item-carteira-bandejao", price: 85, description: "Ao vencer um combate com 25 de Moral ou menos, recupere 4 de Moral.", flavor: "Vencida desde 2013. O caixa ainda aceita." },
  bombons: { name: "Caixa de Bombons", image: "item-bombons", price: 90, description: "Na primeira vez em que ganhar moedas em cada combate, ganhe mais 5.", flavor: "Bombom por fora, recibo por dentro." },
  cueca: { name: "Cueca de Dinheiro", image: "item-cueca", price: 90, description: "Ganhe 5 moedas ao exaurir a primeira carta de cada combate.", flavor: "O dinheiro sobreviveu à queima de arquivo." },
  faixa: { name: "Broche do Foro Privilegiado", image: "item-faixa", price: 100, description: "Comece cada combate com 6 de Guarda.", flavor: "A cobrança chegou. Foi redistribuída." },
  carimbo: { name: "Carimbo da Urgência de Madrugada", image: "item-carimbo", price: 110, description: "Compre uma carta extra no primeiro turno de cada combate.", flavor: "Pauta publicada às 23h59. Aprovada às 00h01." },
  fundo: { name: "Envelope do Orçamento Secreto", image: "item-fundo", price: 90, description: "Ganhe mais 8 moedas ao vencer um combate.", flavor: "O depósito caiu. O campo do remetente veio em branco." },
} as const;

export const consumables = {
  marmita: { name: "Marmita do Bandejão", image: "item-marmita", price: 30, description: "Recupere até 5 de Moral e ganhe 6 de Guarda.", flavor: "A proteína é matéria de pesquisa." },
  megafone: { name: "Megafone Emprestado", image: "item-megafone", price: 30, description: "Ganhe 2 de Força neste turno.", flavor: "Microfonia é palavra de ordem." },
  verba: { name: "Verba de Última Hora", image: "item-verba", price: 25, description: "Ganhe 15 moedas temporárias para pagar cartas neste combate.", flavor: "Se sobrar, tem que devolver." },
  cafe: { name: "Garrafa Térmica da CPI", image: "item-cafe", price: 28, description: "Ganhe 1 de Energia neste turno.", flavor: "O depoente pediu um copo. A comissão abriu outra sessão." },
  regimento: { name: "Regimento de Conveniência", image: "item-regimento", price: 25, description: "Ganhe 8 de Guarda neste turno.", flavor: "Sempre tem um artigo que adia a sua resposta." },
  picanha: { name: "Picanha", image: "item-picanha", price: 35, description: "Recupere até 8 de Moral.", flavor: "A promessa veio malpassada. A Moral agradeceu." },
} as const;

export type RelicId = keyof typeof relics;
export type ConsumableId = keyof typeof consumables;

export type ItemOffer =
  | { kind: "relic"; id: RelicId; sold: boolean }
  | { kind: "consumable"; id: ConsumableId; sold: boolean };

export const leftBuildRelics: readonly RelicId[] = ["poteVento", "carteiraSindicato", "carimboTcu", "carteiraBandejao"];
export const leftBuildConsumables: readonly ConsumableId[] = ["marmita", "megafone", "verba"];
