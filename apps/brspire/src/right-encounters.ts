import type { Rival } from "./catalog";

const rivals = {
  jones: { id: "jones", name: "Jones Manoel", moral: 27, sprite: "rival-jones", intents: [
    { kind: "rally", value: 1, label: "Debate de Três Horas" }, { kind: "attack", value: 5 },
  ] },
  boulos: { id: "boulos", name: "Guilherme Boulos", moral: 40, sprite: "rival-boulos", intents: [
    { kind: "summon", value: 8, label: "Convocação do MTST" }, { kind: "attack", value: 9 },
    { kind: "teamGuard", value: 4, label: "Barricada" },
  ] },
  suplicy: { id: "suplicy", name: "Eduardo Suplicy", moral: 24, sprite: "rival-suplicy", intents: [
    { kind: "teamGuard", value: 3, label: "Renda Básica" },
  ] },
  dilma: { id: "dilma", name: "Dilma Rousseff", moral: 55, sprite: "rival-dilma", intents: [
    { kind: "guard", value: 5, label: "Estocar Vento" }, { kind: "attack", value: 8, label: "Rajada" },
  ] },
  gotinha: { id: "gotinha", name: "Zé Gotinha", moral: 13, sprite: "rival-gotinha", intents: [
    { kind: "heal", value: 4, label: "Dia de Vacinação" }, { kind: "attack", value: 3 },
  ] },
  mandioca: { id: "mandioca", name: "Mandioca Sagrada", moral: 21, sprite: "rival-mandioca", intents: [
    { kind: "guard", value: 2, label: "Criar Raízes" }, { kind: "guard", value: 3, label: "Saudação à Mandioca" },
    { kind: "attack", value: 16, label: "Mandioca Voadora" },
  ] },
  moraes: { id: "moraes", name: "Alexandre de Moraes", moral: 52, sprite: "rival-moraes", intents: [
    { kind: "injunction", value: 1, label: "Por Decisão Monocrática" }, { kind: "attack", value: 13, label: "Bate o Martelo" },
    { kind: "guard", value: 6 }, { kind: "attack", value: 9 },
  ] },
  zanin: { id: "zanin", name: "Cristiano Zanin", moral: 31, sprite: "rival-zanin", intents: [
    { kind: "guard", value: 5, label: "Pedido de Vista" }, { kind: "attack", value: 6, label: "Parecer" },
  ] },
  duda: { id: "duda", name: "Duda Mendonça", moral: 34, sprite: "rival-duda", intents: [
    { kind: "guard", value: 6, label: "Gravar o Jingle" }, { kind: "jingle", value: 2, label: "Horário Eleitoral" },
    { kind: "attack", value: 7 },
  ] },
  santana: { id: "santana", name: "João Santana", moral: 31, sprite: "rival-santana", intents: [
    { kind: "research", value: 1, label: "Pesquisa Interna" }, { kind: "predict", value: 9, guardValue: 6, label: "Resposta da Campanha" },
  ] },
  "carro-som": { id: "carro-som", name: "Carro de Som", moral: 22, sprite: "rival-carro-som", intents: [
    { kind: "guard", value: 3, label: "Teste de Som" }, { kind: "attack", value: 5, label: "Microfonia" },
  ] },
  "militante-mtst": { id: "militante-mtst", name: "Militante do MTST", moral: 12, sprite: "rival-militante-mtst", intents: [
    { kind: "attack", value: 4, label: "Bandeirada" },
  ] },
} satisfies Record<string, Rival>;

export const leftRivalSprites = Object.values(rivals).map(({ sprite }) => sprite);
export const mtstReinforcement: Rival = rivals["militante-mtst"];

const { gotinha, boulos, jones, suplicy, mandioca, dilma, moraes, zanin, duda, santana } = rivals;
const truck = rivals["carro-som"];

const opening: readonly Rival[][] = [[gotinha], [boulos], [jones], [mandioca]];
const duos: readonly Rival[][] = [
  [jones, suplicy], [boulos, gotinha], [mandioca, gotinha], [jones, truck],
  [mandioca, suplicy], [zanin, jones], [boulos, truck], [duda, gotinha],
];
const late: readonly Rival[][] = [
  [boulos, truck, gotinha], [mandioca, santana, suplicy], [dilma, zanin],
  [duda, jones, truck], [zanin, duda, gotinha], [dilma, mandioca, suplicy],
  [moraes, jones], [santana, mandioca], [moraes, zanin, truck],
];

export function rightEncounterOptions(stage: number, progress: number, isBoss: boolean, finalBoss: boolean, classics: readonly Rival[]): readonly (readonly Rival[])[] {
  const [lula, che, stalin] = classics;
  if (finalBoss) return [[lula]];
  if (isBoss && progress === 6) return [[dilma, mandioca]];
  if (isBoss && progress === 12) return [[che]];
  if (isBoss && progress === 17) return [[stalin]];
  if (progress === 0) return [[stage % 2 === 0 ? gotinha : boulos]];
  if (progress === 3) return [[boulos, truck]];
  if (progress === 14) return [[duda, santana], [duda, santana, truck]];
  if (progress === 18) return [[moraes, zanin], [moraes, zanin, jones]];
  return progress < 3 ? opening : progress < 9 ? duos : late;
}
