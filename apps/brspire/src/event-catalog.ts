export type EventDefinition = {
  id: string;
  title: string;
  imageAlt: string;
  intro: string;
  risk: readonly [string, string];
  rest: readonly [string, string];
  special?: { kind: "relic" | "remove" | "upgrade"; label: string; hint: string; result: string };
  outcomes: {
    profit: readonly [string, string];
    injury: readonly [string, string];
    rest: readonly [string, string];
  };
};

export const eventCatalog: readonly EventDefinition[] = [
  {
    id: "terminou-em-pizza",
    title: "Tudo Terminou em Pizza",
    imageAlt: "Uma comissão carimba a caixa de uma pizza fumegante.",
    intro: "A comissão convocou uma coletiva para mostrar o resultado da investigação. O relator acaba de pedir uma grande, meia calabresa.",
    risk: ["Vender o último pedaço", "A imprensa paga pelo furo. Cuidado com a foto de quem ficou com a caixa."],
    rest: ["Pedir um pedaço", "Enquanto discutem a ata, a calabresa ainda está quente."],
    outcomes: {
      profit: ["Deu certo", "O jornal pagou pela exclusiva. A manchete saiu com borda recheada."],
      injury: ["Deu ruim", "O fotógrafo pegou você com a caixa. Agora todo mundo quer saber quem pagou a conta."],
      rest: ["Intervalo", "Você comeu em paz. A comissão pediu a saideira."],
    },
  },
  {
    id: "gostosao-da-paulista",
    title: "O Gostosão da Paulista",
    imageAlt: "Um fortão posa no teto do MASP para as câmeras da avenida.",
    intro: "Um fortão subiu no MASP e transformou a Paulista num ensaio fotográfico. Uma marca quer patrocinar a próxima pose.",
    risk: ["Fechar o patrocínio", "Uma boa foto paga bem. O contrato também exige que você apareça na pose."],
    rest: ["Assistir da calçada", "Lá de baixo dá pra ver tudo, inclusive a escada balançando."],
    outcomes: {
      profit: ["Deu certo", "A foto viralizou. O dinheiro caiu antes do modelo descer."],
      injury: ["Deu ruim", "A foto viralizou pelo motivo errado. Seu equilíbrio virou GIF."],
      rest: ["Intervalo", "Você ficou na calçada e tomou uma água de coco."],
    },
  },
  {
    id: "quebra-pau-plenario",
    title: "Quebra-pau no Plenário",
    imageAlt: "Papéis e um martelo voam por cima das bancadas do plenário.",
    intro: "Uma questão de ordem virou campeonato de arremesso de regimento. Um canal está pagando pelo melhor ângulo.",
    risk: ["Gravar da primeira fila", "O cachê vale um bom corte. A primeira fila também recebe tudo que voa."],
    rest: ["Esperar no corredor", "A porta corta o barulho e a máquina de café ainda está inteira."],
    outcomes: {
      profit: ["Deu certo", "O vídeo pegou o martelo no ar. O canal pagou antes de a sessão voltar."],
      injury: ["Deu ruim", "A transmissão pegou você levando um regimento na testa. O cachê ficou pra próxima sessão."],
      rest: ["Intervalo", "Você ouviu a sessão acabar pelo silêncio do corredor."],
    },
  },
  {
    id: "delacao-premiada",
    title: "Delação Premiada da Odebrecht",
    imageAlt: "Uma pilha de pastas e um gravador ocupam a mesa de depoimento.",
    intro: "Uma empreiteira chegou com tantos anexos que a audiência pediu uma extensão. Um repórter paga por ajuda para decifrar a planilha de apelidos.",
    risk: ["Decifrar os codinomes", "Se encontrar a linha certa, sai o cachê. Se errar a coluna, pode sobrar apelido pra você."],
    rest: ["Desligar o gravador", "Deixa os anexos com a comissão e aproveita o intervalo."],
    outcomes: {
      profit: ["Deu certo", "Você achou a aba certa. O repórter pagou em dinheiro e pediu recibo."],
      injury: ["Deu ruim", "Você confundiu a planilha com o cardápio. Seu apelido acabou sendo Marmita."],
      rest: ["Intervalo", "Você fez uma pausa enquanto a comissão procurava a senha do arquivo."],
    },
  },
  {
    id: "mala-da-jbs",
    title: "A Mala da JBS",
    imageAlt: "Uma mala aberta no estacionamento.",
    intro: "No estacionamento, uma mala espera por alguém que jura que só veio buscar o carro.",
    risk: ["Vender a exclusiva", "O repórter promete cachê. A fonte vai ser você."],
    rest: ["Fazer uma pausa", "O café está quente e a pauta pode esperar."],
    special: { kind: "relic", label: "Abrir a mala", hint: "O que estiver dentro fica com você até o fim da campanha.", result: "O achado ganhou lugar no seu inventário." },
    outcomes: {
      profit: ["Deu certo", "A exclusiva saiu e o repórter pagou o combinado."],
      injury: ["Deu ruim", "A manchete saiu com o seu nome e o cachê ficou com o editor."],
      rest: ["Intervalo", "O café devolveu um pouco de tranquilidade."],
    },
  },
  {
    id: "arquivo-do-mensalao",
    title: "Arquivo do Mensalão",
    imageAlt: "Um triturador espera diante de pilhas de documentos.",
    intro: "O arquivo ficou tão cheio que o funcionário liberou espaço para um último papel no triturador.",
    risk: ["Vender a exclusiva", "O repórter promete cachê. A fonte vai ser você."],
    rest: ["Fazer uma pausa", "O café está quente e a pauta pode esperar."],
    special: { kind: "remove", label: "Triturar uma carta", hint: "Escolha uma cópia do seu baralho para tirar de circulação de vez.", result: "O triturador engoliu a carta. A ata registrou apenas um ruído." },
    outcomes: {
      profit: ["Deu certo", "A exclusiva saiu e o repórter pagou o combinado."],
      injury: ["Deu ruim", "A manchete saiu com o seu nome e o cachê ficou com o editor."],
      rest: ["Intervalo", "O café devolveu um pouco de tranquilidade."],
    },
  },
  {
    id: "cpi-da-pandemia",
    title: "CPI da Pandemia",
    imageAlt: "Um relatório cheio de anotações sobre a mesa de uma audiência.",
    intro: "A comissão abriu prazo para corrigir um documento. A caneta vermelha já está na mesa.",
    risk: ["Vender a exclusiva", "O repórter promete cachê. A fonte vai ser você."],
    rest: ["Fazer uma pausa", "O café está quente e a pauta pode esperar."],
    special: { kind: "upgrade", label: "Apresentar versão revisada", hint: "Escolha uma carta para elevar ao nível 2.", result: "A versão revisada volta mais forte para o seu baralho." },
    outcomes: {
      profit: ["Deu certo", "A exclusiva saiu e o repórter pagou o combinado."],
      injury: ["Deu ruim", "A manchete saiu com o seu nome e o cachê ficou com o editor."],
      rest: ["Intervalo", "O café devolveu um pouco de tranquilidade."],
    },
  },
] as const satisfies readonly EventDefinition[];
