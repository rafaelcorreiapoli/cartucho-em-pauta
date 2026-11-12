export const NICK_LIMIT = 20;
export const INVALID_NICK = 4400;
export const NICK_TAKEN = 4409;
export const nickHint = 'Use de 1 a 20 caracteres: letras, números, espaços, ponto, hífen ou sublinhado.';

export function readNick(value:unknown) {
  if (typeof value!=='string' || value.length>100) return;
  const nick = value.normalize('NFC').trim().replace(/ +/g,' ');
  return nick.length<=NICK_LIMIT && /^[\p{L}\p{M}\p{N} ._-]+$/u.test(nick) && /[\p{L}\p{N}]/u.test(nick) ? nick : undefined;
}

export const nickKey = (nick:string) => nick.normalize('NFKC').toLocaleLowerCase('pt-BR');
