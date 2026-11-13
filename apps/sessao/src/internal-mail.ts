export const internalMailRules = {fee:1.5,cooldownMs:90_000,subjectLength:80,bodyLength:500,history:24} as const;

export type InternalNotice = Readonly<{id:number;author:string;subject:string;body:string}>;
