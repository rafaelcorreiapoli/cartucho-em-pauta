export const documentRules = {forgeryMs:5000,kitPrice:5} as const;
export const internalMailRules = {fee:1.5,cooldownMs:90_000,subjectLength:80,bodyLength:500,history:24} as const;

export type InternalNotice = Readonly<{id:number;author:string;subject:string;body:string;attachment?:MailAttachment}>;

export type PublishedDocument = Readonly<{id:number;title:string;description?:string;signatures:readonly string[]}>;
export type ForensicReport = Readonly<{notice:number;document:PublishedDocument;authentic:boolean}>;
export type MailAttachment =
  | {kind:'document';document:PublishedDocument}
  | {kind:'photo';photo:import('./photography').Photo}
  | {kind:'report';report:ForensicReport};
export type AttachmentRef = {kind:MailAttachment['kind'];id:number};
